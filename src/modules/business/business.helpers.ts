import { Prisma } from '@prisma/client';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { AddressDto } from '@/modules/business/dto';

export type AddressData = Pick<Prisma.AddressUncheckedCreateInput, 'street' | 'exteriorNumber' | 'interiorNumber' | 'neighborhood' | 'municipality' | 'city' | 'state' | 'country' | 'postalCode' | 'references'>;
export type ActiveCounter = (ids: string[]) => Promise<number>;

export function textSearch<TWhere>(search: string, fields: string[]): TWhere[] {
    return fields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) as TWhere[];
}

export function toAddressData(address?: AddressDto): AddressData | undefined {
    if (!address) return undefined;
    return {
        street: address.street,
        exteriorNumber: address.exteriorNumber,
        interiorNumber: address.interiorNumber,
        neighborhood: address.neighborhood,
        municipality: address.municipality,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
        references: address.references,
    };
}

export async function assertActive(checks: Array<{ ids: Array<string | null | undefined>; count: ActiveCounter }>): Promise<void> {
    for (const check of checks) {
        const ids = [...new Set(check.ids.filter((id): id is string => Boolean(id)))];
        if (ids.length === 0) continue;

        const activeRecords = await check.count(ids);
        if (activeRecords !== ids.length) throw invalidRelation();
    }
}

export function notFound() {
    return new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');
}

export function invalidRelation() {
    return new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
}
