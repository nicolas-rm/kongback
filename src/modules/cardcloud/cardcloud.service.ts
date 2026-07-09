import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { invalidRelation } from '@/modules/business/business.helpers';
import { CardcloudExternalService } from '@/modules/cardcloud/cardcloud-external.service';
import {
    AssignCardcloudCardsBulkDto,
    AssignCardcloudCardsDto,
    CardcloudDateRangeQueryDto,
    CardcloudPageQueryDto,
    CreateCardcloudSubaccountDto,
    TransferCardcloudFundsBulkDto,
    TransferCardcloudFundsDto,
    UpdateCardcloudCardNipDto,
    ValidateCardcloudCardDto,
} from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

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
    card_external_id?: string | null;
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

const PAGE_BATCH_SIZE = 5;
const DB_CHUNK_SIZE = 50;
const PAGE_BATCH_DELAY_MS = 300;

@Injectable()
export class CardcloudService {
    private readonly logger = new Logger(CardcloudService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly external: CardcloudExternalService
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

    async syncStock(scope?: CompanyScope): Promise<SyncCardcloudStockResult> {
        const companyId = scope?.companyId;
        if (!companyId || scope?.subCompanyIds) throw invalidRelation();

        const company = await this.loadCompany(companyId);
        const fetchedCards = await this.fetchAllFromCardcloud();
        const deduped = this.dedupeCards(fetchedCards);
        const fetchedExternalIds = deduped.cards.map((card) => this.resolveExternalId(card)!);
        const externalToAssignedCardId = await this.loadAssignedCards(companyId, fetchedExternalIds);
        const cards = this.filterCompanyCards(deduped.cards, company.externalId, externalToAssignedCardId);
        const externalIds = cards.map((card) => this.resolveExternalId(card)!);
        const syncedAt = new Date();
        let synced = 0;
        let skipped = deduped.skipped + (deduped.cards.length - cards.length);

        await this.clearStaleAssignments(companyId, externalToAssignedCardId);

        for (let i = 0; i < cards.length; i += DB_CHUNK_SIZE) {
            const chunk = cards.slice(i, i + DB_CHUNK_SIZE);
            const result = await this.syncChunk(companyId, chunk, externalToAssignedCardId, syncedAt);
            synced += result.synced;
            skipped += result.skipped;
        }

        const removed = await this.prisma.cardcloudCardStock.updateMany({
            where: {
                companyId,
                ...(externalIds.length > 0 ? { externalId: { notIn: externalIds } } : {}),
                providerStatus: { not: Status.inactive },
            },
            data: { providerStatus: Status.inactive, syncedAt },
        });

        this.logger.log(`Cardcloud stock sync company=${companyId} synced=${synced} skipped=${skipped} removed=${removed.count}`);
        return { synced, skipped, removed: removed.count };
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

    private async loadCompany(companyId: string): Promise<{ externalId: string | null }> {
        const company = await this.prisma.company.findFirst({
            where: { id: companyId, status: Status.active },
            select: { externalId: true },
        });
        if (!company) throw invalidRelation();
        return company;
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

    private filterCompanyCards(cards: CardcloudAccountCard[], companyExternalId: string | null, externalToAssignedCardId: Map<string, string>): CardcloudAccountCard[] {
        const normalizedCompanyExternalId = companyExternalId?.trim();
        return cards.filter((card) => {
            const externalId = this.resolveExternalId(card);
            if (!externalId) return false;
            if (externalToAssignedCardId.has(externalId)) return true;
            return Boolean(normalizedCompanyExternalId && card.client_id?.trim() === normalizedCompanyExternalId);
        });
    }

    private async syncChunk(companyId: string, cards: CardcloudAccountCard[], externalToAssignedCardId: Map<string, string>, syncedAt: Date): Promise<{ synced: number; skipped: number }> {
        return this.prisma.$transaction(async (tx) => {
            let synced = 0;
            let skipped = 0;

            for (const card of cards) {
                const externalId = this.resolveExternalId(card);
                if (!externalId) {
                    skipped++;
                    continue;
                }

                const existing = await tx.cardcloudCardStock.findUnique({
                    where: { externalId },
                    select: { id: true, companyId: true },
                });
                if (existing && existing.companyId !== companyId) {
                    skipped++;
                    continue;
                }

                const data = {
                    assignedCardId: externalToAssignedCardId.get(externalId) ?? null,
                    maskedPan: card.masked_pan ?? null,
                    clientId: card.client_id ?? null,
                    balance: this.toDecimal(card.balance),
                    providerStatus: this.toStatus(card.status),
                    syncedAt,
                };

                if (existing) {
                    await tx.cardcloudCardStock.update({ where: { id: existing.id }, data });
                } else {
                    await tx.cardcloudCardStock.create({ data: { companyId, externalId, ...data } });
                }
                synced++;
            }

            return { synced, skipped };
        });
    }

    private async loadAssignedCards(companyId: string, externalIds: string[]): Promise<Map<string, string>> {
        if (externalIds.length === 0) return new Map();
        const cards = await this.prisma.card.findMany({
            where: {
                externalId: { in: externalIds },
                status: Status.active,
                subCompany: { companyId },
            },
            select: { id: true, externalId: true },
        });
        return new Map(cards.map((card) => [card.externalId!, card.id]));
    }

    private async clearStaleAssignments(companyId: string, externalToAssignedCardId: Map<string, string>): Promise<void> {
        if (externalToAssignedCardId.size === 0) return;
        await this.prisma.cardcloudCardStock.updateMany({
            where: {
                companyId,
                assignedCardId: { in: [...externalToAssignedCardId.values()] },
                externalId: { notIn: [...externalToAssignedCardId.keys()] },
            },
            data: { assignedCardId: null },
        });
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
        return card.card_id || card.card_external_id || null;
    }

    private toStatus(status?: string | null): Status {
        const normalized = status?.toLowerCase();
        if (normalized === Status.active) return Status.active;
        if (normalized === Status.suspended || normalized === 'blocked') return Status.suspended;
        return Status.inactive;
    }

    private toDecimal(value?: string | number | null): Prisma.Decimal | null {
        if (value === null || value === undefined || value === '') return null;
        try {
            return new Prisma.Decimal(String(value).replace(/,/g, '').trim());
        } catch {
            return null;
        }
    }
}
