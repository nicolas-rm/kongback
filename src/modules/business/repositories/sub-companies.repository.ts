import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
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
            if (data.isDefault === true) {
                await tx.subCompany.updateMany({
                    where: { companyId: data.companyId, isDefault: true },
                    data: { isDefault: false },
                });
            }
            return tx.subCompany.create({ data: { ...data, addressId }, select: this.select() });
        });
    }

    findMany(where: Prisma.SubCompanyWhereInput, skip: number, take?: number) {
        return this.prisma.subCompany.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.listSelect() });
    }

    count(where: Prisma.SubCompanyWhereInput): Promise<number> {
        return this.prisma.subCompany.count({ where });
    }

    async existsByCompanyKey(companyId: string, key: string, scope?: CompanyScope): Promise<boolean> {
        const count = await this.prisma.subCompany.count({
            where: { AND: [{ companyId, key }, subCompanyScopeWhere(scope)] },
        });
        return count > 0;
    }

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.subCompany.findFirst({ where: { AND: [{ id }, subCompanyScopeWhere(scope)] }, select: this.select() });
    }

    findExportTargetById(id: string, scope?: CompanyScope) {
        return this.prisma.subCompany.findFirst({
            where: { AND: [{ id }, subCompanyScopeWhere(scope)] },
            select: {
                id: true,
                key: true,
                name: true,
            },
        });
    }

    findDriversForExport(subCompanyId: string, scope?: CompanyScope) {
        return this.prisma.driver.findMany({
            where: { subCompanyId, subCompany: subCompanyScopeWhere(scope) },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                name: true,
                externalReference: true,
                status: true,
                vehicles: {
                    orderBy: [{ plates: 'asc' }, { id: 'asc' }],
                    select: {
                        plates: true,
                        economicNumber: true,
                        model: true,
                        card: {
                            select: {
                                externalId: true,
                                stock: {
                                    select: {
                                        clientId: true,
                                        maskedPan: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    findVehiclesForExport(subCompanyId: string, scope?: CompanyScope) {
        return this.prisma.vehicle.findMany({
            where: { subCompanyId, subCompany: subCompanyScopeWhere(scope) },
            orderBy: [{ plates: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                plates: true,
                economicNumber: true,
                model: true,
                year: true,
                odometerControl: true,
                odometerInitial: true,
                status: true,
                fuel: { select: this.fuelSummarySelect() },
                driver: {
                    select: {
                        name: true,
                        externalReference: true,
                    },
                },
                card: {
                    select: {
                        externalId: true,
                        stock: {
                            select: {
                                clientId: true,
                                maskedPan: true,
                            },
                        },
                    },
                },
            },
        });
    }

    findCardsForExport(subCompanyId: string, scope?: CompanyScope) {
        return this.prisma.card.findMany({
            where: { subCompanyId, subCompany: subCompanyScopeWhere(scope) },
            orderBy: [{ assignedAt: 'desc' }, { id: 'asc' }],
            select: {
                id: true,
                externalId: true,
                assignmentMode: true,
                status: true,
                assignedAt: true,
                designFuel: { select: this.fuelSummarySelect() },
                vehicle: {
                    select: {
                        plates: true,
                        economicNumber: true,
                        model: true,
                    },
                },
                stock: {
                    select: {
                        clientId: true,
                        maskedPan: true,
                        providerStatus: true,
                    },
                },
            },
        });
    }

    update(id: string, data: Prisma.SubCompanyUncheckedUpdateInput, address?: AddressData, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.subCompany.findFirst({ where: { AND: [{ id }, subCompanyScopeWhere(scope)] }, select: { id: true, companyId: true, addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            if (data.isDefault === true) {
                await tx.subCompany.updateMany({
                    where: { companyId: current.companyId, id: { not: current.id }, isDefault: true },
                    data: { isDefault: false },
                });
            }
            await tx.subCompany.update({ where: { id: current.id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.subCompany.findFirst({ where: { AND: [{ id: current.id }, subCompanyScopeWhere(scope)] }, select: this.select() });
        });
    }

    deactivate(id: string, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.subCompany.updateMany({ where: { AND: [{ id }, subCompanyScopeWhere(scope)] }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.subCompany.findFirst({ where: { AND: [{ id }, subCompanyScopeWhere(scope)] }, select: this.select() });
        });
    }

    private select(): Prisma.SubCompanySelect {
        return {
            id: true,
            companyId: true,
            key: true,
            cardcloudSubaccountId: true,
            name: true,
            status: true,
            isDefault: true,
            address: { select: this.addresses.select() },
            company: { select: this.companySummarySelect() },
        };
    }

    private listSelect(): Prisma.SubCompanySelect {
        return {
            id: true,
            companyId: true,
            key: true,
            cardcloudSubaccountId: true,
            name: true,
            status: true,
            isDefault: true,
            company: { select: this.companySummarySelect() },
        };
    }

    private companySummarySelect(): Prisma.CompanySelect {
        return {
            id: true,
            key: true,
            name: true,
        };
    }

    private fuelSummarySelect(): Prisma.FuelSelect {
        return {
            id: true,
            code: true,
            name: true,
        };
    }
}
