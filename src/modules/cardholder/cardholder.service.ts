import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CardAssignmentMode, NotificationType, Prisma, Status } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CardcloudDateRangeQueryDto } from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import { FindCardholderVehiclesDto, UpdateCardholderCardNipDto, ValidateCardholderCardDto } from '@/modules/cardholder/dto';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { AuditService } from '@/modules/audit/audit.service';
import { PrismaService } from '@/prisma/prisma.service';

const DRIVER_SELECT = {
    id: true,
    userId: true,
    subCompanyId: true,
    name: true,
    externalReference: true,
    status: true,
    createdAt: true,
    address: {
        select: {
            id: true,
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
        },
    },
    subCompany: {
        select: {
            id: true,
            companyId: true,
            key: true,
            cardcloudSubaccountId: true,
            name: true,
            status: true,
            isDefault: true,
            company: {
                select: {
                    id: true,
                    key: true,
                    name: true,
                    tradeName: true,
                    status: true,
                },
            },
        },
    },
} satisfies Prisma.DriverSelect;

const CARD_SELECT = {
    id: true,
    subCompanyId: true,
    vehicleId: true,
    designFuelId: true,
    externalId: true,
    assignmentMode: true,
    status: true,
    assignedAt: true,
    createdAt: true,
    updatedAt: true,
    stock: {
        select: {
            id: true,
            externalId: true,
            maskedPan: true,
            clientId: true,
            balance: true,
            providerStatus: true,
            assignedCardId: true,
        },
    },
    vehicle: {
        select: {
            id: true,
            plates: true,
            economicNumber: true,
            model: true,
            year: true,
            odometerControl: true,
            odometerInitial: true,
            status: true,
        },
    },
    designFuel: {
        select: {
            id: true,
            code: true,
            name: true,
        },
    },
} satisfies Prisma.CardSelect;

const VEHICLE_SELECT = {
    id: true,
    subCompanyId: true,
    fuelId: true,
    driverId: true,
    plates: true,
    economicNumber: true,
    model: true,
    year: true,
    odometerControl: true,
    odometerInitial: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    fuel: {
        select: {
            id: true,
            code: true,
            name: true,
        },
    },
    card: {
        select: CARD_SELECT,
    },
} satisfies Prisma.VehicleSelect;

type CardholderDriver = Prisma.DriverGetPayload<{ select: typeof DRIVER_SELECT }>;
type CardholderCard = Prisma.CardGetPayload<{ select: typeof CARD_SELECT }>;
type CardholderVehicle = Prisma.VehicleGetPayload<{ select: typeof VEHICLE_SELECT }>;

@Injectable()
export class CardholderService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cardcloud: CardcloudService,
        private readonly crypto: CryptoService,
        private readonly notifications: NotificationsService,
        private readonly audit: AuditService
    ) {}

    async getProfile(user: RequestUser) {
        const driver = await this.findCurrentDriver(user);
        void this.audit.recordCard({ action: 'cardholder_profile_consulted', resourceType: 'Driver', resourceId: driver.id });

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName ?? driver.name,
            status: user.status,
            driver: this.mapDriver(driver),
        };
    }

    async findMySubCompany(user: RequestUser) {
        const driver = await this.findCurrentDriver(user);
        void this.audit.recordCard({ action: 'cardholder_sub_company_consulted', resourceType: 'SubCompany', resourceId: driver.subCompanyId });
        return {
            driverId: driver.id,
            subCompany: driver.subCompany,
        };
    }

    async findMyVehicles(user: RequestUser, dto: FindCardholderVehiclesDto) {
        const driver = await this.findCurrentDriver(user);
        const activeOnly = dto.active ?? true;
        const vehicles = await this.prisma.vehicle.findMany({
            where: {
                driverId: driver.id,
                subCompanyId: driver.subCompanyId,
                ...(activeOnly ? { status: Status.active } : {}),
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: VEHICLE_SELECT,
        });

        void this.audit.recordCard({ action: 'cardholder_vehicles_consulted', resourceType: 'Driver', resourceId: driver.id, metadata: { count: vehicles.length, activeOnly } });
        return vehicles.map((vehicle) => this.mapVehicle(vehicle));
    }

    async findMyCards(user: RequestUser) {
        const driver = await this.findCurrentDriver(user);
        const cards = await this.prisma.card.findMany({
            where: this.ownedCardWhere(driver),
            orderBy: [{ assignedAt: 'desc' }, { createdAt: 'desc' }],
            select: CARD_SELECT,
        });

        void this.audit.recordCard({ action: 'cardholder_cards_consulted', resourceType: 'Driver', resourceId: driver.id, metadata: { count: cards.length } });
        return cards.map((card) => this.mapCard(card));
    }

    async findMyCard(user: RequestUser, cardId: string) {
        const { card } = await this.findOwnedCard(user, cardId);
        void this.audit.recordCard({ action: 'cardholder_card_consulted', resourceType: 'Card', resourceId: card.id });
        return this.mapCard(card);
    }

    async powerOff(user: RequestUser, cardId: string) {
        const { externalId, card } = await this.findOwnedCardExternalTarget(user, cardId);
        const result = await this.executeCardcloudAction(() => this.cardcloud.blockCard(externalId), 'No fue posible bloquear la tarjeta en este momento. Intenta nuevamente.');
        await this.notify(user.id, 'Tarjeta apagada', 'Tu tarjeta se bloqueo correctamente.', `Tarjeta ${this.maskReference(card.stock?.maskedPan ?? card.externalId ?? card.id)}`, NotificationType.warning);
        void this.audit.recordCard({ action: 'cardholder_card_blocked', resourceType: 'Card', resourceId: card.id, metadata: { externalId } });
        return this.withMessage(result, 'La tarjeta se bloqueo correctamente.');
    }

    async powerOn(user: RequestUser, cardId: string) {
        const { externalId, card } = await this.findOwnedCardExternalTarget(user, cardId);
        const result = await this.executeCardcloudAction(() => this.cardcloud.unblockCard(externalId), 'No fue posible desbloquear la tarjeta en este momento. Intenta nuevamente.');
        await this.notify(user.id, 'Tarjeta encendida', 'Tu tarjeta se desbloqueo correctamente.', `Tarjeta ${this.maskReference(card.stock?.maskedPan ?? card.externalId ?? card.id)}`, NotificationType.success);
        void this.audit.recordCard({ action: 'cardholder_card_unblocked', resourceType: 'Card', resourceId: card.id, metadata: { externalId } });
        return this.withMessage(result, 'La tarjeta se desbloqueo correctamente.');
    }

    async getMovements(user: RequestUser, cardId: string, query: CardcloudDateRangeQueryDto) {
        const { externalId, card } = await this.findOwnedCardExternalTarget(user, cardId);
        const movements = await this.executeCardcloudAction(() => this.cardcloud.getCardMovements(externalId, query), 'No fue posible consultar los movimientos de la tarjeta en este momento. Intenta nuevamente.');
        void this.audit.recordCard({ action: 'cardholder_card_movements_consulted', resourceType: 'Card', resourceId: card.id, metadata: { externalId, from: query.from, to: query.to } });
        return movements;
    }

    async getSensitiveData(user: RequestUser, cardId: string) {
        const { externalId, card } = await this.findOwnedCardExternalTarget(user, cardId);
        const result = await this.executeCardcloudAction(() => this.cardcloud.getCardSensitiveData(externalId), 'No fue posible consultar los datos de la tarjeta en este momento. Intenta nuevamente.');
        await this.notify(user.id, 'Consulta de datos de tarjeta', 'Consultaste los datos de tu tarjeta.', `Tarjeta ${this.maskReference(this.extractPan(result) ?? card.stock?.maskedPan ?? card.id)}`, NotificationType.warning);
        void this.audit.recordCard({ action: 'cardholder_card_sensitive_data_consulted', resourceType: 'Card', resourceId: card.id, metadata: { externalId } });
        return result;
    }

    async updateNip(user: RequestUser, cardId: string, dto: UpdateCardholderCardNipDto) {
        if (dto.old_nip === dto.new_nip) {
            throw new BadRequestException('El nuevo NIP debe ser diferente al actual.');
        }

        const { externalId, card } = await this.findOwnedCardExternalTarget(user, cardId);
        const result = await this.executeCardcloudAction(() => this.cardcloud.updateCardNip(externalId, dto), 'No fue posible actualizar el NIP de la tarjeta en este momento. Intenta nuevamente.');
        void this.audit.recordCard({ action: 'cardholder_card_nip_updated', resourceType: 'Card', resourceId: card.id, metadata: { externalId } });
        return result;
    }

    async validatePhysicalCard(user: RequestUser, dto: ValidateCardholderCardDto) {
        const driver = await this.findCurrentDriver(user);
        const cards = await this.prisma.card.findMany({
            where: {
                ...this.ownedCardWhere(driver),
                stock: {
                    is: {
                        clientId: dto.clientId,
                        assignedCardId: { not: null },
                    },
                },
            },
            take: 2,
            select: CARD_SELECT,
        });

        if (cards.length === 0) {
            throw new NotFoundException('Esta tarjeta no esta asignada a tu cuenta. Verifica los datos o contacta a tu empresa.');
        }

        if (cards.length > 1) {
            throw new ConflictException('No pudimos identificar una sola tarjeta con esos datos. Contacta a tu empresa.');
        }

        const card = cards[0];
        const externalId = this.resolveCardExternalId(card);
        const sensitive = await this.executeCardcloudAction(() => this.cardcloud.getCardSensitiveData(externalId), 'No fue posible validar la tarjeta en este momento. Intenta nuevamente.');
        const panDigits = this.extractPan(sensitive)?.replace(/\D/g, '') ?? '';
        if (panDigits.length < 8) {
            throw new BadRequestException('No fue posible validar la tarjeta en este momento. Intenta nuevamente.');
        }

        const validated = await this.executeCardcloudAction(
            () =>
                this.cardcloud.validateCard({
                    card: panDigits.slice(-8),
                    pin: dto.nip,
                    moye: dto.vigencia.replace(/\D/g, ''),
                }),
            'No pudimos validar la tarjeta con los datos capturados. Verifica la vigencia y el NIP.'
        );
        const validatedCardId = this.extractStringField(validated, ['card_id', 'cardId', 'id']);

        if (!validatedCardId || validatedCardId !== externalId) {
            throw new BadRequestException('No pudimos validar la tarjeta con los datos capturados. Verifica la vigencia y el NIP.');
        }

        void this.audit.recordCard({ action: 'cardholder_physical_card_validated', resourceType: 'Card', resourceId: card.id, metadata: { externalId, clientId: dto.clientId } });

        return {
            valid: true,
            message: 'La tarjeta se valido correctamente.',
            card: this.mapCard(card),
        };
    }

    private async findCurrentDriver(user: RequestUser): Promise<CardholderDriver> {
        const driver = await this.prisma.driver.findFirst({
            where: {
                userId: user.id,
                status: Status.active,
                subCompany: {
                    status: Status.active,
                    company: { status: Status.active },
                },
            },
            select: DRIVER_SELECT,
        });

        if (!driver) {
            throw new ForbiddenException('Este apartado esta disponible solo para tarjetahabientes con conductor activo.');
        }

        return driver;
    }

    private ownedCardWhere(driver: CardholderDriver): Prisma.CardWhereInput {
        return {
            subCompanyId: driver.subCompanyId,
            status: Status.active,
            assignmentMode: CardAssignmentMode.vehicle,
            vehicle: {
                is: {
                    driverId: driver.id,
                    status: Status.active,
                },
            },
        };
    }

    private async findOwnedCard(user: RequestUser, cardId: string): Promise<{ driver: CardholderDriver; card: CardholderCard }> {
        const driver = await this.findCurrentDriver(user);
        const card = await this.prisma.card.findFirst({
            where: {
                id: cardId,
                ...this.ownedCardWhere(driver),
            },
            select: CARD_SELECT,
        });

        if (!card) {
            throw new NotFoundException('No encontramos la tarjeta solicitada en tu cuenta.');
        }

        return { driver, card };
    }

    private async findOwnedCardExternalTarget(user: RequestUser, cardId: string): Promise<{ card: CardholderCard; externalId: string }> {
        const { card } = await this.findOwnedCard(user, cardId);
        return {
            card,
            externalId: this.resolveCardExternalId(card),
        };
    }

    private resolveCardExternalId(card: CardholderCard): string {
        const externalId = card.externalId ?? card.stock?.externalId ?? null;
        if (!externalId) {
            throw new BadRequestException('No fue posible consultar la tarjeta en este momento. Intenta nuevamente.');
        }

        return externalId;
    }

    private async executeCardcloudAction<T>(action: () => Promise<T>, message: string): Promise<T> {
        try {
            return await action();
        } catch {
            throw new BadRequestException(message);
        }
    }

    private async notify(userId: string, title: string, message: string, detail: string, type: NotificationType): Promise<void> {
        await this.notifications
            .createForUser(userId, {
                title,
                message,
                detail,
                type,
            })
            .catch(() => null);
    }

    private mapDriver(driver: CardholderDriver) {
        return {
            id: driver.id,
            name: driver.name,
            externalReference: driver.externalReference,
            status: driver.status,
            createdAt: driver.createdAt,
            address: driver.address,
            subCompany: driver.subCompany,
        };
    }

    private mapVehicle(vehicle: CardholderVehicle) {
        return {
            ...vehicle,
            card: vehicle.card ? this.mapCard(vehicle.card) : null,
        };
    }

    private mapCard(card: CardholderCard) {
        return {
            ...card,
            stock: card.stock
                ? {
                      ...card.stock,
                      balance: this.decryptBalance(card.stock.balance),
                      isAssigned: card.stock.assignedCardId !== null,
                  }
                : null,
        };
    }

    private decryptBalance(value?: string | Prisma.Decimal | null): string | null {
        if (value === null || value === undefined) return null;
        const plaintext = this.crypto.decrypt(String(value)) ?? String(value);
        try {
            return new Prisma.Decimal(String(plaintext).replace(/,/g, '').trim()).toFixed(2);
        } catch {
            return null;
        }
    }

    private withMessage(result: unknown, message: string) {
        if (this.isRecord(result)) return { ...result, message };
        return { message, result };
    }

    private extractPan(value: unknown): string | null {
        const direct = this.extractStringField(value, ['pan', 'card', 'cardNumber']);
        if (direct) return direct;
        if (!this.isRecord(value)) return null;

        return this.extractPan(value.sensitive_data_raw) ?? this.extractPan(value.sensitiveData) ?? this.extractPan(value.data);
    }

    private extractStringField(value: unknown, fields: string[]): string | null {
        if (!this.isRecord(value)) return null;

        for (const field of fields) {
            const fieldValue = value[field];
            if (typeof fieldValue === 'string' && fieldValue.trim()) return fieldValue.trim();
        }

        return null;
    }

    private maskReference(value: string): string {
        const clean = value.replace(/\s+/g, '');
        if (clean.length <= 4) return clean;
        return `${'*'.repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
