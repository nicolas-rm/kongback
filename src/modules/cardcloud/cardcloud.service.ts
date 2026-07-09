import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import { PrismaService } from '@/prisma/prisma.service';
import { invalidRelation, notFound } from '@/modules/business/business.helpers';
import { CardcloudExternalService } from '@/modules/cardcloud/cardcloud-external.service';
import {
    AssignCardcloudCardsBulkDto,
    AssignCardcloudCardsDto,
    AssignCardcloudSubCompanyDto,
    CardcloudDateRangeQueryDto,
    CardcloudPageQueryDto,
    CreateCardcloudSubaccountDto,
    FindCardcloudStockDto,
    TransferCardcloudFundsBulkDto,
    TransferCardcloudFundsDto,
    UpdateCardcloudCardNipDto,
    ValidateCardcloudCardDto,
} from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import { paginate } from '@/utilities/pagination/pagination.dto';

type SyncCardcloudStockResult = {
    synced: number;
    skipped: number;
    removed: number;
};

type TransferCardcloudFundsBulkItemResult = {
    index: number;
    success: boolean;
    data?: unknown;
    error?: string;
};

interface CardcloudAccountCard {
    card_id?: string | null;
    client_id?: string | null;
    masked_pan?: string | null;
    balance?: string | number | null;
    status?: string | null;
}

interface CardcloudAccountCardsRaw {
    cards: CardcloudAccountCard[];
    page: number;
    total_pages: number;
    total_records: number;
}

const LOCAL_STOCK_SELECT = {
    id: true,
    subCompanyId: true,
    assignedCardId: true,
    maskedPan: true,
    clientId: true,
    balance: true,
    providerStatus: true,
    assignedCard: {
        select: {
            id: true,
            assignmentMode: true,
            status: true,
        },
    },
    subCompany: {
        select: {
            id: true,
            companyId: true,
            key: true,
            name: true,
        },
    },
} satisfies Prisma.CardcloudSelect;

type LocalStockRecord = Prisma.CardcloudGetPayload<{ select: typeof LOCAL_STOCK_SELECT }>;

const PAGE_BATCH_SIZE = 5;
const DB_CHUNK_SIZE = 50;
const PAGE_BATCH_DELAY_MS = 300;

@Injectable()
export class CardcloudService {
    private readonly logger = new Logger(CardcloudService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly external: CardcloudExternalService,
        private readonly cryptoService: CryptoService
    ) {}

    getCardMovement(uuid: string) {
        return this.external.get(`/v1/card/movement/${uuid}`);
    }

    getCard(uuid: string) {
        return this.external.get(`/v1/card/${uuid}`);
    }

    getCardMovements(uuid: string, query: CardcloudDateRangeQueryDto) {
        return this.external.get(`/v1/card/${uuid}/movements`, this.dateRangeParams(query));
    }

    getCardSensitiveData(uuid: string) {
        return this.external.get(`/v1/card/${uuid}/sensitive`);
    }

    getCardCvv(uuid: string) {
        return this.external.get(`/v1/card/${uuid}/cvv`);
    }

    updateCardNip(uuid: string, dto: UpdateCardcloudCardNipDto) {
        return this.external.patch(`/v1/card/${uuid}/update_nip`, dto);
    }

    validateCard(dto: ValidateCardcloudCardDto) {
        return this.external.post('/card/validate', dto);
    }

    blockCard(uuid: string) {
        return this.external.post(`/v1/card/${uuid}/block`);
    }

    unblockCard(uuid: string) {
        return this.external.post(`/v1/card/${uuid}/unblock`);
    }

    getSubaccounts() {
        return this.external.get('/v1/subaccounts');
    }

    getSubaccount(uuid: string) {
        return this.external.get(`/v1/subaccounts/${uuid}`);
    }

    getSubaccountCards(uuid: string, query: CardcloudPageQueryDto) {
        return this.external.get(`/v1/subaccounts/${uuid}/cards`, { page: query.page });
    }

    createSubaccount(dto: CreateCardcloudSubaccountDto) {
        return this.external.post('/v1/subaccounts', dto);
    }

    getSubaccountMovements(uuid: string, query: CardcloudDateRangeQueryDto) {
        return this.external.get(`/v1/subaccounts/${uuid}/movements`, this.dateRangeParams(query));
    }

    assignCards(dto: AssignCardcloudCardsDto) {
        return this.external.post('/v1/account/cards/assign', dto);
    }

    assignCardsBulk(dto: AssignCardcloudCardsBulkDto) {
        return this.external.post('/v1/account/cards/assign_bulk', dto);
    }

    transferFunds(dto: TransferCardcloudFundsDto) {
        return this.external.post('/v1/transfer', this.normalizeTransfer(dto));
    }

    async transferFundsBulk(dto: TransferCardcloudFundsBulkDto) {
        const results: TransferCardcloudFundsBulkItemResult[] = [];

        for (let index = 0; index < dto.transfers.length; index++) {
            try {
                const data = await this.external.post('/v1/transfer', this.normalizeTransfer(dto.transfers[index]));
                results.push({ index, success: true, data });
            } catch (error) {
                results.push({ index, success: false, error: this.errorMessage(error) });
            }
        }

        const succeeded = results.filter((result) => result.success).length;
        return {
            results,
            summary: {
                total: results.length,
                succeeded,
                failed: results.length - succeeded,
            },
        };
    }

    getAccount() {
        return this.external.get('/v1/account');
    }

    getAccountMovements(query: CardcloudDateRangeQueryDto) {
        return this.external.get('/v1/account/movements', this.dateRangeParams(query));
    }

    async findStock(dto: FindCardcloudStockDto) {
        const where: Prisma.CardcloudWhereInput = {
            subCompanyId: dto.subCompanyId,
            providerStatus: dto.providerStatus,
            ...(dto.search ? { OR: this.stockSearch(dto.search) } : {}),
        };

        const [records, total] = await Promise.all([
            this.prisma.cardcloud.findMany({
                where,
                skip: dto.skip,
                take: dto.actualLimit,
                orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                select: this.localStockSelect(),
            }),
            this.prisma.cardcloud.count({ where }),
        ]);

        return paginate(records.map((record) => this.serializeLocalStock(record)), total, dto);
    }

    async syncStock(): Promise<SyncCardcloudStockResult> {
        const fetchedCards = await this.fetchAllFromCardcloud();
        const deduped = this.dedupeCards(fetchedCards);
        const externalIds = deduped.cards.map((card) => this.resolveExternalId(card)!);
        let synced = 0;
        let skipped = deduped.skipped;

        for (let i = 0; i < deduped.cards.length; i += DB_CHUNK_SIZE) {
            const chunk = deduped.cards.slice(i, i + DB_CHUNK_SIZE);
            const result = await this.syncChunk(chunk);
            synced += result.synced;
            skipped += result.skipped;
        }

        const removed = await this.prisma.cardcloud.updateMany({
            where: {
                ...(externalIds.length > 0 ? { externalId: { notIn: externalIds } } : {}),
                providerStatus: { not: 'inactive' },
            },
            data: { providerStatus: 'inactive' },
        });

        this.logger.log(`Cardcloud stock sync global synced=${synced} skipped=${skipped} removed=${removed.count}`);
        return { synced, skipped, removed: removed.count };
    }

    async assignSubCompany(id: string, dto: AssignCardcloudSubCompanyDto) {
        await this.assertActiveSubCompany(dto.subCompanyId);

        const updated = await this.prisma.cardcloud.updateMany({
            where: { id },
            data: { subCompanyId: dto.subCompanyId },
        });

        if (updated.count === 0) throw notFound();
        return this.findLocalStock(id);
    }

    async unassignSubCompany(id: string) {
        const updated = await this.prisma.cardcloud.updateMany({
            where: { id },
            data: { subCompanyId: null },
        });

        if (updated.count === 0) throw notFound();
        return this.findLocalStock(id);
    }

    private dateRangeParams(query: CardcloudDateRangeQueryDto) {
        return { from: query.from, to: query.to };
    }

    private normalizeTransfer(input: TransferCardcloudFundsDto): TransferCardcloudFundsDto {
        const amount = Number(input.amount);
        if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) {
            throw new BadRequestException('El monto debe ser un numero con valor absoluto mayor o igual a 0.01');
        }

        if (amount > 0) {
            return { ...input, amount: Number(amount.toFixed(2)) };
        }

        return {
            ...input,
            sourceType: input.destinationType,
            source: input.destination,
            destinationType: input.sourceType,
            destination: input.source,
            amount: Number(Math.abs(amount).toFixed(2)),
        };
    }

    private errorMessage(error: unknown): string {
        if (error instanceof Error) return error.message.slice(0, 500) || 'Error desconocido';
        if (typeof error === 'string') return error.slice(0, 500) || 'Error desconocido';
        return 'Error desconocido';
    }

    private dedupeCards(cards: CardcloudAccountCard[]): { cards: CardcloudAccountCard[]; skipped: number } {
        const uniqueCards = new Map<string, CardcloudAccountCard>();
        let skipped = 0;

        for (const card of cards) {
            const externalId = this.resolveExternalId(card);
            if (!externalId || uniqueCards.has(externalId)) {
                skipped++;
                continue;
            }
            uniqueCards.set(externalId, card);
        }

        return { cards: [...uniqueCards.values()], skipped };
    }

    private async syncChunk(cards: CardcloudAccountCard[]): Promise<{ synced: number; skipped: number }> {
        return this.prisma.$transaction(async (tx) => {
            let synced = 0;
            let skipped = 0;

            for (const card of cards) {
                const externalId = this.resolveExternalId(card);
                if (!externalId) {
                    skipped++;
                    continue;
                }

                const existing = await tx.cardcloud.findUnique({
                    where: { externalId },
                    select: { id: true },
                });

                const data = {
                    maskedPan: this.maskPanKeepingLastFour(card.masked_pan),
                    clientId: card.client_id ?? null,
                    balance: this.encryptBalance(card.balance),
                    providerStatus: this.cleanText(card.status),
                };

                if (existing) {
                    await tx.cardcloud.update({ where: { id: existing.id }, data });
                } else {
                    await tx.cardcloud.create({ data: { externalId, ...data } });
                }
                synced++;
            }

            return { synced, skipped };
        });
    }

    private async assertActiveSubCompany(subCompanyId: string): Promise<void> {
        const count = await this.prisma.subCompany.count({
            where: {
                id: subCompanyId,
                status: Status.active,
            },
        });
        if (count !== 1) throw invalidRelation();
    }

    private stockSearch(search: string): Prisma.CardcloudWhereInput[] {
        return [
            { externalId: { contains: search, mode: 'insensitive' } },
            { maskedPan: { contains: search, mode: 'insensitive' } },
            { clientId: { contains: search, mode: 'insensitive' } },
            { subCompany: { key: { contains: search, mode: 'insensitive' } } },
            { subCompany: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }

    private async findLocalStock(id: string) {
        const stock = await this.prisma.cardcloud.findUnique({
            where: { id },
            select: this.localStockSelect(),
        });
        if (!stock) throw notFound();
        return this.serializeLocalStock(stock);
    }

    private localStockSelect(): Prisma.CardcloudSelect {
        return LOCAL_STOCK_SELECT;
    }

    private serializeLocalStock(stock: LocalStockRecord) {
        return {
            ...stock,
            maskedPan: this.maskPanKeepingLastFour(stock.maskedPan),
            balance: this.decryptBalance(stock.balance),
        };
    }

    private async fetchAllFromCardcloud(): Promise<CardcloudAccountCard[]> {
        const first = await this.external.get<CardcloudAccountCardsRaw>('/v1/account/cards', { page: 1 });
        const all = [...first.cards];
        const totalPages = first.total_pages;

        for (let start = 2; start <= totalPages; start += PAGE_BATCH_SIZE) {
            const end = Math.min(start + PAGE_BATCH_SIZE - 1, totalPages);
            const pages = Array.from({ length: end - start + 1 }, (_value, index) => start + index);
            const results = await Promise.all(pages.map((page) => this.external.get<CardcloudAccountCardsRaw>('/v1/account/cards', { page })));
            for (const result of results) all.push(...result.cards);
            if (end < totalPages) await new Promise((resolve) => setTimeout(resolve, PAGE_BATCH_DELAY_MS));
        }

        return all;
    }

    private resolveExternalId(card: CardcloudAccountCard): string | null {
        return this.cleanText(card.card_id);
    }

    private cleanText(value?: string | null): string | null {
        const clean = value?.trim();
        return clean || null;
    }

    private maskPanKeepingLastFour(value?: string | null): string | null {
        const token = value?.replace(/[^0-9Xx]/g, '');
        const digits = token?.replace(/\D/g, '');
        if (!digits) return null;
        const lastFour = digits.slice(-4);
        const maskedLength = Math.max((token?.length ?? 0) - lastFour.length, 12);
        return `${'X'.repeat(maskedLength)}${lastFour}`;
    }

    private encryptBalance(value?: string | number | null): string | null {
        const normalized = this.normalizeBalance(value);
        return normalized ? this.cryptoService.encrypt(normalized) : null;
    }

    private decryptBalance(value?: string | Prisma.Decimal | null): string | null {
        if (value === null || value === undefined) return null;
        const plaintext = this.cryptoService.decrypt(String(value)) ?? String(value);
        return this.normalizeBalance(plaintext);
    }

    private normalizeBalance(value?: string | number | Prisma.Decimal | null): string | null {
        if (value === null || value === undefined || value === '') return null;
        try {
            return new Prisma.Decimal(String(value).replace(/,/g, '').trim()).toFixed(2);
        } catch {
            return null;
        }
    }
}
