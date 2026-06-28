import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AddressData } from '@/modules/business/business.helpers';
import { BusinessAddressRepository } from '@/modules/business/repositories/business-address.repository';

@Injectable()
export class SubCompaniesRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly addresses: BusinessAddressRepository
    ) {}

    create(data: Prisma.SubCompanyUncheckedCreateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const addressId = await this.addresses.create(tx, address);
            return tx.subCompany.create({ data: { ...data, addressId }, select: this.select() });
        });
    }

    findMany(where: Prisma.SubCompanyWhereInput, skip: number, take?: number) {
        return this.prisma.subCompany.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.select() });
    }

    count(where: Prisma.SubCompanyWhereInput): Promise<number> {
        return this.prisma.subCompany.count({ where });
    }

    findById(id: string) {
        return this.prisma.subCompany.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.SubCompanyUncheckedUpdateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.subCompany.findUnique({ where: { id }, select: { addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.subCompany.update({ where: { id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.subCompany.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.subCompany.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.subCompany.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.SubCompanySelect {
        return {
            id: true,
            companyId: true,
            key: true,
            externalId: true,
            name: true,
            status: true,
            phone: true,
            isDefault: true,
            address: { select: this.addresses.select() },
        };
    }
}
