import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AddressData } from '@/modules/business/business.helpers';
import { BusinessAddressRepository } from '@/modules/business/repositories/business-address.repository';

@Injectable()
export class DriversRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly addresses: BusinessAddressRepository
    ) {}

    create(data: Prisma.DriverUncheckedCreateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const addressId = await this.addresses.create(tx, address);
            return tx.driver.create({ data: { ...data, addressId }, select: this.select() });
        });
    }

    findMany(where: Prisma.DriverWhereInput, skip: number, take?: number) {
        return this.prisma.driver.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.select() });
    }

    count(where: Prisma.DriverWhereInput): Promise<number> {
        return this.prisma.driver.count({ where });
    }

    findById(id: string) {
        return this.prisma.driver.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.DriverUncheckedUpdateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.driver.findUnique({ where: { id }, select: { addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.driver.update({ where: { id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.driver.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.driver.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.driver.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.DriverSelect {
        return {
            id: true,
            subCompanyId: true,
            userId: true,
            name: true,
            externalReference: true,
            status: true,
            address: { select: this.addresses.select() },
        };
    }
}
