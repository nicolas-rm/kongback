import { Injectable } from '@nestjs/common';
import { Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BusinessRelationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    countActiveCompanies(ids: string[], organizationId?: string): Promise<number> {
        return this.prisma.company.count({ where: { id: { in: ids }, organizationId, status: Status.active } });
    }

    countActiveSubCompanies(ids: string[], organizationId?: string): Promise<number> {
        return this.prisma.subCompany.count({ where: { id: { in: ids }, status: Status.active, company: { organizationId } } });
    }

    countActiveUsers(ids: string[]): Promise<number> {
        return this.prisma.user.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveDrivers(ids: string[], organizationId?: string): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: { organizationId } } } });
    }

    countActiveDriversBySubCompany(ids: string[], subCompanyId: string, organizationId?: string): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, subCompanyId, status: Status.active, subCompany: { company: { organizationId } } } });
    }

    countActiveFuels(ids: string[]): Promise<number> {
        return this.prisma.fuel.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveVehicles(ids: string[], organizationId?: string): Promise<number> {
        return this.prisma.vehicle.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: { organizationId } } } });
    }

    countActiveCards(ids: string[], organizationId?: string): Promise<number> {
        return this.prisma.card.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: { organizationId } } } });
    }

    countActiveStations(ids: string[], organizationId?: string): Promise<number> {
        return this.prisma.station.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: { organizationId } } } });
    }
}
