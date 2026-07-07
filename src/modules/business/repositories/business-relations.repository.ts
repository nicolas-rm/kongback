import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BusinessRelationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    countActiveCompanies(ids: string[], companyId?: string): Promise<number> {
        return this.prisma.company.count({ where: this.companyWhere(ids, companyId) });
    }

    countActiveSubCompanies(ids: string[], companyId?: string): Promise<number> {
        return this.prisma.subCompany.count({ where: { id: { in: ids }, status: Status.active, company: this.companyRelationWhere(companyId) } });
    }

    countActiveUsers(ids: string[]): Promise<number> {
        return this.prisma.user.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveDrivers(ids: string[], companyId?: string): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(companyId) } } });
    }

    countActiveDriversBySubCompany(ids: string[], subCompanyId: string, companyId?: string): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, subCompanyId, status: Status.active, subCompany: { company: this.companyRelationWhere(companyId) } } });
    }

    countActiveFuels(ids: string[]): Promise<number> {
        return this.prisma.fuel.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveVehicles(ids: string[], companyId?: string): Promise<number> {
        return this.prisma.vehicle.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(companyId) } } });
    }

    countActiveCards(ids: string[], companyId?: string): Promise<number> {
        return this.prisma.card.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(companyId) } } });
    }

    countActiveStations(ids: string[], companyId?: string): Promise<number> {
        return this.prisma.station.count({ where: { id: { in: ids }, status: Status.active, subCompany: { company: this.companyRelationWhere(companyId) } } });
    }

    private companyWhere(ids: string[], companyId?: string): Prisma.CompanyWhereInput {
        return {
            AND: [
                { id: { in: ids } },
                companyId ? { id: companyId } : {},
                {
                    status: Status.active,
                },
            ],
        };
    }

    private companyRelationWhere(companyId?: string): Prisma.CompanyWhereInput {
        return {
            ...(companyId ? { id: companyId } : {}),
        };
    }
}
