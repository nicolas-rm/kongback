import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { AuditService } from '@/modules/audit/audit.service';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { notFound, textSearch } from '@/modules/business/business.helpers';
import { CreateFuelDto, FindStatusRecordsDto, UpdateFuelDto } from '@/modules/business/dto';
import { FuelsRepository } from '@/modules/business/repositories/fuels.repository';

@Injectable()
export class FuelsService {
    constructor(
        private readonly repository: FuelsRepository,
        private readonly audit: AuditService
    ) {}

    async create(dto: CreateFuelDto) {
        const fuel = await this.repository.create({
            code: dto.code,
            name: dto.name,
            status: dto.status ?? Status.active,
        });
        void this.audit.recordBusiness({ action: 'fuel_created', resourceType: 'Fuel', resourceId: fuel.id, after: fuel });
        return fuel;
    }

    async findAll(dto: FindStatusRecordsDto) {
        const where: Prisma.FuelWhereInput = {
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.FuelWhereInput>(dto.search, ['code', 'name']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const fuel = await this.repository.findById(id);
        if (!fuel) throw notFound();
        return fuel;
    }

    async update(id: string, dto: UpdateFuelDto) {
        const fuel = await this.repository.update(id, {
            code: dto.code,
            name: dto.name,
            status: dto.status,
        });
        if (!fuel) throw notFound();
        void this.audit.recordBusiness({ action: 'fuel_updated', resourceType: 'Fuel', resourceId: fuel.id, metadata: dto, after: fuel });
        return fuel;
    }

    async deactivate(id: string) {
        const fuel = await this.repository.deactivate(id);
        if (!fuel) throw notFound();
        void this.audit.recordBusiness({ action: 'fuel_deactivated', resourceType: 'Fuel', resourceId: fuel.id, after: { id: fuel.id, status: fuel.status } });
        return { id: fuel.id, status: fuel.status };
    }
}
