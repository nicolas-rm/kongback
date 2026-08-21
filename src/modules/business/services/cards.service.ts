import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CardAssignmentMode, Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, invalidRelation, notFound, textSearch } from '@/modules/business/business.helpers';
import {
    AssignCardsToSubCompanyDto,
    AssignCardVehicleDto,
    CreateCardDto,
    FindCardsDto,
    FindStatusRecordsDto,
    SyncSubCompanyCardsDto,
    UpdateCardAssignmentDto,
    UpdateCardDto,
    ValidateOwnedCardDto,
} from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardsRepository } from '@/modules/business/repositories/cards.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';
import { CardcloudDateRangeQueryDto } from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';

type CardcloudSubaccountCard = {
    card_id?: string | null;
    card_external_id?: string | null;
};

type CardcloudSubaccountCardsRaw = {
    cards?: CardcloudSubaccountCard[];
    total_pages?: string | number | null;
};

@Injectable()
export class CardsService {
    constructor(
        private readonly repository: CardsRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly vehicles: VehiclesRepository,
        private readonly cardcloud: CardcloudService
    ) {}

    async create(dto: CreateCardDto, scope?: CompanyScope) {
        const assignmentMode = dto.vehicleId ? CardAssignmentMode.vehicle : CardAssignmentMode.unassigned;
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, scope) },
            { ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids, scope) },
            { ids: [dto.designFuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        if (dto.vehicleId) {
            const vehicle = await this.vehicles.findById(dto.vehicleId, scope);
            if (!vehicle || vehicle.subCompanyId !== dto.subCompanyId) throw invalidRelation();
            if (dto.designFuelId && vehicle.fuelId !== dto.designFuelId) throw invalidRelation();
        }

        return this.repository.create({
            subCompanyId: dto.subCompanyId,
            vehicleId: dto.vehicleId ?? null,
            designFuelId: dto.designFuelId ?? null,
            externalId: dto.externalId ?? null,
            assignmentMode,
            status: dto.status ?? Status.active,
            assignedAt: assignmentMode === CardAssignmentMode.unassigned ? null : (dto.assignedAt ?? new Date()),
        });
    }

    async findAll(dto: FindCardsDto, scope?: CompanyScope) {
        const where: Prisma.CardWhereInput = {
            subCompanyId: scopedSubCompanyIdFilter(dto.subCompanyId, scope),
            subCompany: subCompanyScopeWhere(scope),
            vehicleId: dto.vehicleId,
            designFuelId: dto.designFuelId,
            assignmentMode: dto.assignmentMode,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardWhereInput>(dto.search, ['externalId']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, scope?: CompanyScope) {
        const card = await this.repository.findById(id, scope);
        if (!card) throw notFound();
        return card;
    }

    async validateOwnedCard(dto: ValidateOwnedCardDto, scope?: CompanyScope) {
        const candidates = await this.repository.findAssignedStockByClientId(dto.clientId, scope);
        if (candidates.length === 0) throw notFound();
        if (candidates.length > 1) throw new ConflictException('No pudimos identificar una sola tarjeta con esos datos.');

        const stock = candidates[0];
        if (!stock.assignedCard) throw notFound();

        const sensitive = await this.cardcloud.getCardSensitiveData(stock.externalId);
        const panDigits = this.extractPanDigits(sensitive);
        const validated = await this.cardcloud.validateCard({
            card: panDigits.slice(-8),
            pin: dto.nip,
            moye: dto.vigencia.replace(/\D/g, ''),
        });

        const validatedCardId = this.extractValidatedCardId(validated);
        if (!validatedCardId) throw new BadRequestException('No pudimos validar la tarjeta con el proveedor. Intenta nuevamente.');
        if (validatedCardId !== stock.externalId) throw new BadRequestException('Los datos no corresponden a la tarjeta seleccionada.');

        return {
            valid: true,
            card: {
                id: stock.assignedCard.id,
                externalId: stock.externalId,
                clientId: stock.clientId,
                maskedPan: stock.maskedPan,
                status: stock.assignedCard.status,
                subCompanyId: stock.assignedCard.subCompanyId,
                vehicleId: stock.assignedCard.vehicleId,
                assignmentMode: stock.assignedCard.assignmentMode,
            },
        };
    }

    async getMovements(id: string, dto: CardcloudDateRangeQueryDto, scope?: CompanyScope) {
        const card = await this.repository.findById(id, scope);
        if (!card) throw notFound();
        if (!card.externalId) throw invalidRelation();

        return this.cardcloud.getCardMovements(card.externalId, dto);
    }

    async findByDesignFuel(designFuelId: string, dto: FindStatusRecordsDto, scope?: CompanyScope) {
        await assertActive([{ ids: [designFuelId], count: (ids) => this.relations.countActiveFuels(ids) }]);

        const where: Prisma.CardWhereInput = {
            subCompany: subCompanyScopeWhere(scope),
            designFuelId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardWhereInput>(dto.search, ['externalId']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async assignCardsToSubCompany(dto: AssignCardsToSubCompanyDto, scope?: CompanyScope) {
        const target = await this.resolveCardcloudTarget(dto.subCompanyId, scope);
        const response = await this.cardcloud.assignCardsBulk({
            subaccount_id: target.cardcloudSubaccountId,
            cards: dto.cards,
        });
        const externalIds = this.resolveCardIdsFromResponse(response, dto.cards);
        const result = await this.repository.syncExternalCardsToSubCompany(target.id, externalIds);

        return {
            subCompanyId: target.id,
            cardcloudSubaccountId: target.cardcloudSubaccountId,
            ...result,
        };
    }

    async syncSubCompanyCards(dto: SyncSubCompanyCardsDto, scope?: CompanyScope) {
        const target = await this.resolveCardcloudTarget(dto.subCompanyId, scope);
        const cards = await this.fetchAllSubaccountCards(target.cardcloudSubaccountId);
        const externalIds = cards.map((card) => this.resolveCardExternalId(card)).filter((externalId): externalId is string => Boolean(externalId));
        const result = await this.repository.syncExternalCardsToSubCompany(target.id, externalIds);

        return {
            subCompanyId: target.id,
            cardcloudSubaccountId: target.cardcloudSubaccountId,
            fetched: cards.length,
            ...result,
        };
    }

    async update(id: string, dto: UpdateCardDto, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();

        await assertActive([{ ids: [dto.designFuelId], count: (ids) => this.relations.countActiveFuels(ids) }]);

        if (dto.designFuelId && current.vehicleId) {
            const vehicle = await this.vehicles.findById(current.vehicleId, scope);
            if (!vehicle || vehicle.fuelId !== dto.designFuelId) throw invalidRelation();
        }

        const data: Prisma.CardUncheckedUpdateInput = {
            designFuelId: dto.designFuelId,
            externalId: dto.externalId,
            status: dto.status,
        };

        const card = await this.repository.update(id, data, scope);
        if (!card) throw notFound();
        return card;
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const card = await this.repository.deactivate(id, scope);
        if (!card) throw notFound();
        return { id: card.id, status: card.status };
    }

    async assignVehicle(id: string, dto: AssignCardVehicleDto, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        await assertActive([{ ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids, scope) }]);

        const vehicle = await this.vehicles.findById(dto.vehicleId, scope);
        if (!vehicle || vehicle.subCompanyId !== current.subCompanyId) throw invalidRelation();
        if (current.designFuelId && vehicle.fuelId !== current.designFuelId) throw invalidRelation();

        const assignedAt = dto.assignedAt ?? current.assignedAt ?? new Date();
        const card = await this.repository.update(
            id,
            {
                vehicleId: dto.vehicleId,
                assignmentMode: CardAssignmentMode.vehicle,
                assignedAt,
            },
            scope
        );
        if (!card) throw notFound();
        return { id: card.id, vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt };
    }

    async updateAssignment(id: string, dto: UpdateCardAssignmentDto, scope?: CompanyScope) {
        if (dto.assignmentMode === CardAssignmentMode.unassigned || dto.vehicleId === null) {
            return this.unassign(id, scope);
        }

        if (!dto.vehicleId) throw invalidRelation();
        return this.assignVehicle(id, { vehicleId: dto.vehicleId, assignedAt: dto.assignedAt }, scope);
    }

    async unassign(id: string, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        const card = await this.repository.update(
            id,
            {
                vehicleId: null,
                assignmentMode: CardAssignmentMode.unassigned,
                assignedAt: null,
            },
            scope
        );
        if (!card) throw notFound();
        return { id: card.id, vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt };
    }

    private async resolveCardcloudTarget(subCompanyId: string, scope?: CompanyScope): Promise<{ id: string; cardcloudSubaccountId: string }> {
        const target = await this.relations.findActiveSubCompanyCardcloudTarget(subCompanyId, scope);
        if (!target?.cardcloudSubaccountId) throw invalidRelation();

        return { id: target.id, cardcloudSubaccountId: target.cardcloudSubaccountId };
    }

    private resolveCardIdsFromResponse(response: unknown, fallback: string[]): string[] {
        if (!this.isRecord(response) || !Array.isArray(response.cards)) return fallback;

        const resolved = response.cards.map((card) => this.resolveCardExternalId(card)).filter((externalId): externalId is string => Boolean(externalId));
        return resolved.length > 0 ? resolved : fallback;
    }

    private async fetchAllSubaccountCards(subaccountId: string): Promise<CardcloudSubaccountCard[]> {
        const first = (await this.cardcloud.getSubaccountCards(subaccountId, { page: '1' })) as CardcloudSubaccountCardsRaw;
        const all = [...(first.cards ?? [])];
        const totalPages = this.resolveTotalPages(first.total_pages);

        for (let page = 2; page <= totalPages; page++) {
            const current = (await this.cardcloud.getSubaccountCards(subaccountId, { page: String(page) })) as CardcloudSubaccountCardsRaw;
            all.push(...(current.cards ?? []));
        }

        return all;
    }

    private resolveTotalPages(value: string | number | null | undefined): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return 1;
        return Math.floor(parsed);
    }

    private resolveCardExternalId(card: unknown): string | null {
        if (!this.isRecord(card)) return null;

        const id = card.card_id ?? card.card_external_id;
        if (typeof id !== 'string') return null;

        const clean = id.trim();
        return clean || null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private extractPanDigits(response: unknown): string {
        const source = this.isRecord(response) && this.isRecord(response.sensitive_data_raw) ? response.sensitive_data_raw : response;
        const pan = this.isRecord(source) ? source.pan : null;
        const digits = typeof pan === 'string' ? pan.replace(/\D/g, '') : '';
        if (digits.length < 8) throw new BadRequestException('No pudimos obtener los datos necesarios para validar la tarjeta.');
        return digits;
    }

    private extractValidatedCardId(response: unknown): string | null {
        if (!this.isRecord(response)) return null;
        const id = response.card_id ?? response.card_external_id;
        return typeof id === 'string' && id.trim() ? id.trim() : null;
    }
}
