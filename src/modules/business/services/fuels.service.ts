import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { notFound, textSearch } from '@/modules/business/business.helpers';
import { CreateFuelDto, FindStatusRecordsDto, UpdateFuelDto } from '@/modules/business/dto';
import { FuelsRepository } from '@/modules/business/repositories/fuels.repository';

@Injectable()
export class FuelsService {
    constructor(private readonly repository: FuelsRepository) {}

    create(dto: CreateFuelDto) {
        return this.repository.create({
            code: dto.code,
            name: dto.name,
            status: dto.status ?? Status.active,
        });
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
        return fuel;
    }

    async deactivate(id: string) {
        const fuel = await this.repository.deactivate(id);
        if (!fuel) throw notFound();
        return { id: fuel.id, status: fuel.status };
    }
}
