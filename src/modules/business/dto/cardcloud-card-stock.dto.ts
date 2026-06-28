import { Status } from '@prisma/client';
import { ValidatorDate, ValidatorEnum, ValidatorNumber, ValidatorString, ValidatorUUID } from '@/decorators';

export class CreateCardcloudCardStockDto {
    @ValidatorString()
    externalId!: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    assignedCardId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    maskedPan?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    clientId?: string | null;

    @ValidatorNumber({ optional: true, type: 'float', min: 0 })
    balance?: number;

    @ValidatorEnum(Status, { optional: true })
    providerStatus?: Status;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    syncedAt?: Date | null;
}

export class UpdateCardcloudCardStockDto {
    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    assignedCardId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    maskedPan?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    clientId?: string | null;

    @ValidatorNumber({ optional: true, type: 'float', min: 0 })
    balance?: number;

    @ValidatorEnum(Status, { optional: true })
    providerStatus?: Status;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    syncedAt?: Date | null;
}
