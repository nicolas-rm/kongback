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

    createWithDefaultSubCompany(
        data: Prisma.CompanyUncheckedCreateInput,
        defaultSubCompany: Pick<Prisma.SubCompanyUncheckedCreateInput, 'key' | 'cardcloudSubaccountId' | 'name' | 'status' | 'isDefault'>,
        address?: AddressData
    ) {
        return this.prisma.$transaction(async (tx) => {
            const companyAddressId = await this.addresses.create(tx, address);
            const company = await tx.company.create({ data: { ...data, addressId: companyAddressId }, select: this.select() });

            const subCompanyAddressId = await this.addresses.create(tx, address);
            const createdDefaultSubCompany = await tx.subCompany.create({
                data: {
                    ...defaultSubCompany,
                    companyId: company.id,
                    addressId: subCompanyAddressId,
                },
                select: this.defaultSubCompanySelect(),
            });

            return { company, defaultSubCompany: createdDefaultSubCompany };
        });
    }

    async countCreateConflicts(key: string, externalId?: string | null): Promise<number> {
        return this.prisma.company.count({
            where: {
                OR: [{ key }, ...(externalId ? [{ externalId }] : [])],
            },
        });
    }

    findMany(where: Prisma.CompanyWhereInput, skip: number, take?: number) {
        return this.prisma.company.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.listSelect() });
    }

    count(where: Prisma.CompanyWhereInput): Promise<number> {
        return this.prisma.company.count({ where });
    }

    async findAccessibleCompanyIds(userId: string): Promise<string[]> {
        const accesses = await this.prisma.userAccess.findMany({
            where: { userId, companyId: { not: null }, company: { status: Status.active } },
            distinct: ['companyId'],
            select: { companyId: true },
        });

        return accesses.map((access) => access.companyId).filter((id): id is string => Boolean(id));
    }

    findById(id: string, companyId?: string) {
        return this.prisma.company.findFirst({ where: this.scopeWhere(id, companyId), select: this.select() });
    }

    findAccessibleById(id: string, userId: string) {
        return this.prisma.company.findFirst({ where: { id, status: Status.active, accesses: { some: { userId } } }, select: this.select() });
    }

    update(id: string, data: Prisma.CompanyUncheckedUpdateInput, address?: AddressData, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.company.findFirst({ where: this.scopeWhere(id, companyId), select: { id: true, addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.company.update({ where: { id: current.id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.company.findFirst({ where: this.scopeWhere(current.id, companyId), select: this.select() });
        });
    }

    deactivate(id: string, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.company.updateMany({ where: this.scopeWhere(id, companyId), data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.company.findFirst({ where: this.scopeWhere(id, companyId), select: this.select() });
        });
    }

    private scopeWhere(id: string, companyId?: string): Prisma.CompanyWhereInput {
        return {
            AND: [{ id }, companyId ? { id: companyId } : {}],
        };
    }

    private select(): Prisma.CompanySelect {
        return {
            id: true,
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
            key: true,
            externalId: true,
            name: true,
            tradeName: true,
            status: true,
        };
    }

    private defaultSubCompanySelect(): Prisma.SubCompanySelect {
        return {
            id: true,
            companyId: true,
            key: true,
            cardcloudSubaccountId: true,
            name: true,
            status: true,
            isDefault: true,
            address: { select: this.addresses.select() },
        };
    }
}
