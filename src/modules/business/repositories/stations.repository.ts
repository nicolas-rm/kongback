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
        return this.prisma.station.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.listSelect() });
    }

    count(where: Prisma.StationWhereInput): Promise<number> {
        return this.prisma.station.count({ where });
    }

    findById(id: string, companyId?: string) {
        return this.prisma.station.findFirst({ where: { id, subCompany: { company: this.companyScope(companyId) } }, select: this.select() });
    }

    update(id: string, data: Prisma.StationUncheckedUpdateInput, address?: AddressData, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.station.findFirst({ where: { id, subCompany: { company: this.companyScope(companyId) } }, select: { id: true, addressId: true } });
            if (!current) return null;

            const addressId = await this.addresses.upsert(tx, current.addressId, address);
            await tx.station.update({ where: { id: current.id }, data: { ...data, ...(addressId ? { addressId } : {}) } });
            return tx.station.findFirst({ where: { id: current.id, subCompany: { company: this.companyScope(companyId) } }, select: this.select() });
        });
    }

    deactivate(id: string, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.station.updateMany({ where: { id, subCompany: { company: this.companyScope(companyId) } }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.station.findFirst({ where: { id, subCompany: { company: this.companyScope(companyId) } }, select: this.select() });
        });
    }

    private companyScope(companyId?: string): Prisma.CompanyWhereInput {
        return {
            ...(companyId ? { id: companyId } : {}),
        };
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
            subCompany: { select: this.subCompanySummarySelect() },
        };
    }

    private listSelect(): Prisma.StationSelect {
        return {
            id: true,
            subCompanyId: true,
            stationNumber: true,
            name: true,
            lat: true,
            lon: true,
            status: true,
            subCompany: { select: this.subCompanySummarySelect() },
        };
    }

    private subCompanySummarySelect(): Prisma.SubCompanySelect {
        return {
            id: true,
            key: true,
            name: true,
        };
    }
}
