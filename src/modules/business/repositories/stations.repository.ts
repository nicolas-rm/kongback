import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AddressData } from '@/modules/business/business.helpers';
import { BusinessAddressRepository } from '@/modules/business/repositories/business-address.repository';

@Injectable()
export class StationsRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly addresses: BusinessAddressRepository
    ) {}

    create(data: Prisma.StationUncheckedCreateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const addressId = await this.addresses.create(tx, address);
            return tx.station.create({ data: { ...data, addressId }, select: this.select() });
        });
    }

    findMany(where: Prisma.StationWhereInput, skip: number, take?: number) {
        return this.prisma.station.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.select() });
    }

    count(where: Prisma.StationWhereInput): Promise<number> {
        return this.prisma.station.count({ where });
    }

    findById(id: string) {
        return this.prisma.station.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.StationUncheckedUpdateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.station.findUnique({ where: { id }, select: { addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.station.update({ where: { id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.station.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.station.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.station.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.StationSelect {
        return {
            id: true,
            subCompanyId: true,
            stationNumber: true,
            name: true,
            lat: true,
            lon: true,
            status: true,
            address: { select: this.addresses.select() },
        };
    }
}
