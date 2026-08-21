import { CardAssignmentMode, Status } from '@prisma/client';
import { IsString } from 'class-validator';
import { ValidatorArray, ValidatorDate, ValidatorEnum, ValidatorString, ValidatorUUID } from '@/decorators';

export class CreateCardDto {
    @ValidatorUUID()
    subCompanyId!: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    vehicleId?: string | null;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    designFuelId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalId?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    assignedAt?: Date | null;
}

export class UpdateCardDto {
    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    designFuelId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalId?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}

export class AssignCardVehicleDto {
    @ValidatorUUID()
    vehicleId!: string;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    assignedAt?: Date | null;
}

export class UpdateCardAssignmentDto {
    @ValidatorEnum([CardAssignmentMode.unassigned, CardAssignmentMode.vehicle], { optional: true })
    assignmentMode?: CardAssignmentMode;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    vehicleId?: string | null;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    assignedAt?: Date | null;
}

export class ValidateOwnedCardDto {
    @ValidatorString()
    clientId!: string;

    @ValidatorString()
    nip!: string;

    @ValidatorString()
    vigencia!: string;
}

export class AssignCardsToSubCompanyDto {
    @ValidatorUUID()
    subCompanyId!: string;

    @ValidatorArray({ minSize: 1, maxSize: 100, unique: true })
    @IsString({ each: true })
    cards!: string[];
}

export class SyncSubCompanyCardsDto {
    @ValidatorUUID()
    subCompanyId!: string;
}
