import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AddressData } from '@/modules/business/business.helpers';
import { BusinessAddressRepository } from '@/modules/business/repositories/business-address.repository';

@Injectable()
export class CompaniesRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly addresses: BusinessAddressRepository
    ) {}

    create(data: Prisma.CompanyUncheckedCreateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const addressId = await this.addresses.create(tx, address);
            return tx.company.create({ data: { ...data, addressId }, select: this.select() });
        });
    }

    findMany(where: Prisma.CompanyWhereInput, skip: number, take?: number) {
        return this.prisma.company.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.listSelect() });
    }

    count(where: Prisma.CompanyWhereInput): Promise<number> {
        return this.prisma.company.count({ where });
    }

    findById(id: string, organizationId: string) {
        return this.prisma.company.findFirst({ where: { id, organizationId }, select: this.select() });
    }

    update(id: string, organizationId: string, data: Prisma.CompanyUncheckedUpdateInput, address?: AddressData) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.company.findFirst({ where: { id, organizationId }, select: { id: true, addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.company.update({ where: { id: current.id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.company.findFirst({ where: { id: current.id, organizationId }, select: this.select() });
        });
    }

    deactivate(id: string, organizationId: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.company.updateMany({ where: { id, organizationId }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.company.findFirst({ where: { id, organizationId }, select: this.select() });
        });
    }

    private select(): Prisma.CompanySelect {
        return {
            id: true,
            organizationId: true,
            key: true,
            externalId: true,
            name: true,
            tradeName: true,
            status: true,
            address: { select: this.addresses.select() },
        };
    }

    private listSelect(): Prisma.CompanySelect {
        return {
            id: true,
            organizationId: true,
            key: true,
            externalId: true,
            name: true,
            tradeName: true,
            status: true,
        };
    }
}
