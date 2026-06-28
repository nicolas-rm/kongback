import { Injectable } from '@nestjs/common';
import { Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BusinessRelationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    countActiveCompanies(ids: string[]): Promise<number> {
        return this.prisma.company.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveSubCompanies(ids: string[]): Promise<number> {
        return this.prisma.subCompany.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveUsers(ids: string[]): Promise<number> {
        return this.prisma.user.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveDrivers(ids: string[]): Promise<number> {
        return this.prisma.driver.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveFuels(ids: string[]): Promise<number> {
        return this.prisma.fuel.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveVehicles(ids: string[]): Promise<number> {
        return this.prisma.vehicle.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveCards(ids: string[]): Promise<number> {
        return this.prisma.card.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveStations(ids: string[]): Promise<number> {
        return this.prisma.station.count({ where: { id: { in: ids }, status: Status.active } });
    }
}
