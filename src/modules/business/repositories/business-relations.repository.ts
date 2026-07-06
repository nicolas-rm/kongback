import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BusinessRelationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    countActiveCompanies(ids: string[], organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.company.count({ where: this.companyWhere(ids, organizationId, companyId) });
    }

    countActiveSubCompanies(ids: string[], organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.subCompany.count({ where: { id: { in: ids }, status: Status.active, company: this.companyRelationWhere(organizationId, companyId) } });
    }

    countActiveUsers(ids: string[]): Promise<number> {
        return this.prisma.user.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveDrivers(ids: string[], organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(organizationId, companyId) } } });
    }

    countActiveDriversBySubCompany(ids: string[], subCompanyId: string, organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, subCompanyId, status: Status.active, subCompany: { company: this.companyRelationWhere(organizationId, companyId) } } });
    }

    countActiveFuels(ids: string[]): Promise<number> {
        return this.prisma.fuel.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveVehicles(ids: string[], organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.vehicle.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(organizationId, companyId) } } });
    }

    countActiveCards(ids: string[], organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.card.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(organizationId, companyId) } } });
    }

    countActiveStations(ids: string[], organizationId?: string, companyId?: string): Promise<number> {
        return this.prisma.station.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(organizationId, companyId) } } });
    }

    private companyWhere(ids: string[], organizationId?: string, companyId?: string): Prisma.CompanyWhereInput {
        return {
            AND: [
                { id: { in: ids } },
                companyId ? { id: companyId } : {},
                {
                    organizationId,
                    status: Status.active,
                },
            ],
        };
    }

    private companyRelationWhere(organizationId?: string, companyId?: string): Prisma.CompanyWhereInput {
        return {
            organizationId,
            ...(companyId ? { id: companyId } : {}),
        };
    }
}
