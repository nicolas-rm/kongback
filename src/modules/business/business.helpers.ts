import { CardAssignmentMode, Prisma } from '@prisma/client';
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
        if (activeRecords !== ids.length) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
    }
}

export function resolveAssignmentMode(driverId: string | null, vehicleId: string | null): CardAssignmentMode {
    if (vehicleId) return CardAssignmentMode.vehicle;
    if (driverId) return CardAssignmentMode.driver;
    return CardAssignmentMode.unassigned;
}

export function assertCardAssignment(assignmentMode: CardAssignmentMode, driverId: string | null, vehicleId: string | null): void {
    if (driverId && vehicleId) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidData, 'Asignacion de tarjeta invalida');
    if (assignmentMode === CardAssignmentMode.driver && !driverId) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidData, 'Asignacion de tarjeta invalida');
    if (assignmentMode === CardAssignmentMode.vehicle && !vehicleId) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidData, 'Asignacion de tarjeta invalida');
    if (assignmentMode === CardAssignmentMode.unassigned && (driverId || vehicleId)) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidData, 'Asignacion de tarjeta invalida');
}

export function notFound() {
    return new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');
}
