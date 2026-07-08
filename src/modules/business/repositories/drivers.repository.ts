import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
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
        return this.prisma.driver.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.listSelect() });
    }

    count(where: Prisma.DriverWhereInput): Promise<number> {
        return this.prisma.driver.count({ where });
    }

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.driver.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
    }

    update(id: string, data: Prisma.DriverUncheckedUpdateInput, address?: AddressData, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.driver.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: { id: true, addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.driver.update({ where: { id: current.id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.driver.findFirst({ where: { id: current.id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
        });
    }

    deactivate(id: string, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.driver.updateMany({ where: { id, subCompany: subCompanyScopeWhere(scope) }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.driver.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
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
            subCompany: { select: this.subCompanySummarySelect() },
            user: { select: this.userSummarySelect() },
        };
    }

    private listSelect(): Prisma.DriverSelect {
        return {
            id: true,
            subCompanyId: true,
            userId: true,
            name: true,
            externalReference: true,
            status: true,
            subCompany: { select: this.subCompanySummarySelect() },
            user: { select: this.userSummarySelect() },
        };
    }

    private subCompanySummarySelect(): Prisma.SubCompanySelect {
        return {
            id: true,
            key: true,
            name: true,
        };
    }

    private userSummarySelect(): Prisma.UserSelect {
        return {
            id: true,
            username: true,
            fullName: true,
        };
    }
}
