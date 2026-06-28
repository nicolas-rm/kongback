import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AddressData } from '@/modules/business/business.helpers';

@Injectable()
export class BusinessAddressRepository {
    async create(tx: Prisma.TransactionClient, address?: AddressData): Promise<string | undefined> {
        if (!this.hasData(address)) return undefined;

        const created = await tx.address.create({ data: address, select: { id: true } });
        return created.id;
    }

    async upsert(tx: Prisma.TransactionClient, currentAddressId: string | null, address?: AddressData): Promise<string | undefined> {
        if (!this.hasData(address)) return undefined;
        if (currentAddressId) {
            await tx.address.update({ where: { id: currentAddressId }, data: address });
            return currentAddressId;
        }

        const created = await tx.address.create({ data: address, select: { id: true } });
        return created.id;
    }

    select(): Prisma.AddressSelect {
        return {
            street: true,
            exteriorNumber: true,
            interiorNumber: true,
            neighborhood: true,
            municipality: true,
            city: true,
            state: true,
            country: true,
            postalCode: true,
            references: true,
        };
    }

    private hasData(address?: AddressData): address is AddressData {
        return Boolean(address && Object.values(address).some((value) => value !== undefined));
    }
}
