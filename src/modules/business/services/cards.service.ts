import { Injectable } from '@nestjs/common';
import { CardAssignmentMode, Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, assertCardAssignment, notFound, resolveAssignmentMode, textSearch } from '@/modules/business/business.helpers';
import { CreateCardDto, FindCardsDto, UpdateCardDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardsRepository } from '@/modules/business/repositories/cards.repository';

@Injectable()
export class CardsService {
    constructor(
        private readonly repository: CardsRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(dto: CreateCardDto) {
        const assignmentMode = dto.assignmentMode ?? resolveAssignmentMode(dto.driverId ?? null, dto.vehicleId ?? null);
        assertCardAssignment(assignmentMode, dto.driverId ?? null, dto.vehicleId ?? null);
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDrivers(ids) },
            { ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        return this.repository.create({
            subCompanyId: dto.subCompanyId,
            vehicleId: dto.vehicleId ?? null,
            driverId: dto.driverId ?? null,
            fuelId: dto.fuelId ?? null,
            externalId: dto.externalId ?? null,
            assignmentMode,
            status: dto.status ?? Status.active,
            assignedAt: assignmentMode === CardAssignmentMode.unassigned ? null : (dto.assignedAt ?? new Date()),
        });
    }

    async findAll(dto: FindCardsDto) {
        const where: Prisma.CardWhereInput = {
            subCompanyId: dto.subCompanyId,
            vehicleId: dto.vehicleId,
            driverId: dto.driverId,
            fuelId: dto.fuelId,
            assignmentMode: dto.assignmentMode,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardWhereInput>(dto.search, ['externalId']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const card = await this.repository.findById(id);
        if (!card) throw notFound();
        return card;
    }

    async update(id: string, dto: UpdateCardDto) {
        const current = await this.repository.findById(id);
        if (!current) throw notFound();

        const driverId = dto.driverId !== undefined ? dto.driverId : current.driverId;
        const vehicleId = dto.vehicleId !== undefined ? dto.vehicleId : current.vehicleId;
        const assignmentMode = dto.assignmentMode ?? (dto.driverId !== undefined || dto.vehicleId !== undefined ? resolveAssignmentMode(driverId, vehicleId) : current.assignmentMode);

        assertCardAssignment(assignmentMode, driverId, vehicleId);
        await assertActive([
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDrivers(ids) },
            { ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        const data: Prisma.CardUncheckedUpdateInput = {
            vehicleId: dto.vehicleId,
            driverId: dto.driverId,
            fuelId: dto.fuelId,
            externalId: dto.externalId,
            assignmentMode: dto.assignmentMode ?? (dto.driverId !== undefined || dto.vehicleId !== undefined ? assignmentMode : undefined),
            status: dto.status,
        };

        if (assignmentMode === CardAssignmentMode.unassigned) {
            data.assignedAt = null;
        } else if (dto.assignedAt !== undefined) {
            data.assignedAt = dto.assignedAt;
        } else if (!current.assignedAt || current.assignmentMode === CardAssignmentMode.unassigned) {
            data.assignedAt = new Date();
        }

        const card = await this.repository.update(id, data);
        if (!card) throw notFound();
        return card;
    }

    async deactivate(id: string) {
        const card = await this.repository.deactivate(id);
        if (!card) throw notFound();
        return { id: card.id, status: card.status };
    }
}
