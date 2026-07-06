import { Injectable } from '@nestjs/common';
import { CardAssignmentMode, Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, invalidRelation, notFound, textSearch } from '@/modules/business/business.helpers';
import { AssignCardVehicleDto, CreateCardDto, FindCardsDto, FindStatusRecordsDto, UpdateCardDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardsRepository } from '@/modules/business/repositories/cards.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';

@Injectable()
export class CardsService {
    constructor(
        private readonly repository: CardsRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly vehicles: VehiclesRepository
    ) {}

    async create(organizationId: string, dto: CreateCardDto, companyId?: string) {
        const assignmentMode = dto.vehicleId ? CardAssignmentMode.vehicle : CardAssignmentMode.unassigned;
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, organizationId, companyId) },
            { ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids, organizationId, companyId) },
            { ids: [dto.designFuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        if (dto.vehicleId) {
            const vehicle = await this.vehicles.findById(dto.vehicleId, organizationId, companyId);
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

    async findAll(organizationId: string, dto: FindCardsDto, companyId?: string) {
        const where: Prisma.CardWhereInput = {
            subCompanyId: dto.subCompanyId,
            subCompany: { company: { organizationId, ...(companyId ? { id: companyId } : {}) } },
            vehicleId: dto.vehicleId,
            designFuelId: dto.designFuelId,
            assignmentMode: dto.assignmentMode,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardWhereInput>(dto.search, ['externalId']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string, companyId?: string) {
        const card = await this.repository.findById(id, organizationId, companyId);
        if (!card) throw notFound();
        return card;
    }

    async findByDesignFuel(organizationId: string, designFuelId: string, dto: FindStatusRecordsDto, companyId?: string) {
        await assertActive([{ ids: [designFuelId], count: (ids) => this.relations.countActiveFuels(ids) }]);

        const where: Prisma.CardWhereInput = {
            subCompany: { company: { organizationId, ...(companyId ? { id: companyId } : {}) } },
            designFuelId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardWhereInput>(dto.search, ['externalId']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async update(organizationId: string, id: string, dto: UpdateCardDto, companyId?: string) {
        const current = await this.repository.findById(id, organizationId, companyId);
        if (!current) throw notFound();

        await assertActive([{ ids: [dto.designFuelId], count: (ids) => this.relations.countActiveFuels(ids) }]);

        if (dto.designFuelId && current.vehicleId) {
            const vehicle = await this.vehicles.findById(current.vehicleId, organizationId, companyId);
            if (!vehicle || vehicle.fuelId !== dto.designFuelId) throw invalidRelation();
        }

        const data: Prisma.CardUncheckedUpdateInput = {
            designFuelId: dto.designFuelId,
            externalId: dto.externalId,
            status: dto.status,
        };

        const card = await this.repository.update(id, organizationId, data, companyId);
        if (!card) throw notFound();
        return card;
    }

    async deactivate(organizationId: string, id: string, companyId?: string) {
        const card = await this.repository.deactivate(id, organizationId, companyId);
        if (!card) throw notFound();
        return { id: card.id, status: card.status };
    }

    async assignVehicle(organizationId: string, id: string, dto: AssignCardVehicleDto, companyId?: string) {
        const current = await this.repository.findById(id, organizationId, companyId);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        await assertActive([{ ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids, organizationId, companyId) }]);

        const vehicle = await this.vehicles.findById(dto.vehicleId, organizationId, companyId);
        if (!vehicle || vehicle.subCompanyId !== current.subCompanyId) throw invalidRelation();
        if (current.designFuelId && vehicle.fuelId !== current.designFuelId) throw invalidRelation();

        const assignedAt = dto.assignedAt ?? current.assignedAt ?? new Date();
        const card = await this.repository.update(
            id,
            organizationId,
            {
                vehicleId: dto.vehicleId,
                assignmentMode: CardAssignmentMode.vehicle,
                assignedAt,
            },
            companyId
        );
        if (!card) throw notFound();
        return { id: card.id, vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt };
    }

    async unassign(organizationId: string, id: string, companyId?: string) {
        const current = await this.repository.findById(id, organizationId, companyId);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        const card = await this.repository.update(
            id,
            organizationId,
            {
                vehicleId: null,
                assignmentMode: CardAssignmentMode.unassigned,
                assignedAt: null,
            },
            companyId
        );
        if (!card) throw notFound();
        return { id: card.id, vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt };
    }
}
