import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { companyScopeWhere, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';

@Injectable()
export class BusinessRelationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    countActiveCompanies(ids: string[], scope?: CompanyScope): Promise<number> {
        return this.prisma.company.count({ where: this.companyWhere(ids, scope) });
    }

    countActiveSubCompanies(ids: string[], scope?: CompanyScope): Promise<number> {
        return this.prisma.subCompany.count({ where: { AND: [{ id: { in: ids } }, { status: Status.active }, subCompanyScopeWhere(scope)] } });
    }

    countActiveUsers(ids: string[]): Promise<number> {
        return this.prisma.user.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveDrivers(ids: string[], scope?: CompanyScope): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, status: Status.active, subCompany: subCompanyScopeWhere(scope) } });
    }

    countActiveDriversBySubCompany(ids: string[], subCompanyId: string, scope?: CompanyScope): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, subCompanyId, status: Status.active, subCompany: subCompanyScopeWhere(scope) } });
    }

    countActiveFuels(ids: string[]): Promise<number> {
        return this.prisma.fuel.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveVehicles(ids: string[], scope?: CompanyScope): Promise<number> {
        return this.prisma.vehicle.count({ where: { id: { in: ids }, status: Status.active, subCompany: subCompanyScopeWhere(scope) } });
    }

    countActiveCards(ids: string[], scope?: CompanyScope): Promise<number> {
        return this.prisma.card.count({ where: { id: { in: ids }, status: Status.active, subCompany: subCompanyScopeWhere(scope) } });
    }

    countActiveStations(ids: string[], scope?: CompanyScope): Promise<number> {
        return this.prisma.station.count({ where: { id: { in: ids }, status: Status.active, subCompany: subCompanyScopeWhere(scope) } });
    }

    private companyWhere(ids: string[], scope?: CompanyScope): Prisma.CompanyWhereInput {
        return {
            AND: [
                { id: { in: ids } },
                companyScopeWhere(scope),
                {
                    status: Status.active,
                },
            ],
        };
    }
}
