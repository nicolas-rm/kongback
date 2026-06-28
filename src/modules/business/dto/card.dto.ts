import { CardAssignmentMode, Status } from '@prisma/client';
import { ValidatorDate, ValidatorEnum, ValidatorString, ValidatorUUID } from '@/decorators';

export class CreateCardDto {
    @ValidatorUUID()
    subCompanyId!: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    vehicleId?: string | null;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    driverId?: string | null;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    designFuelId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalId?: string | null;

    @ValidatorEnum(CardAssignmentMode, { optional: true })
    assignmentMode?: CardAssignmentMode;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    assignedAt?: Date | null;
}

export class UpdateCardDto {
    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    vehicleId?: string | null;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    driverId?: string | null;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    designFuelId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalId?: string | null;

    @ValidatorEnum(CardAssignmentMode, { optional: true })
    assignmentMode?: CardAssignmentMode;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorDate({ optional: true, emptyTo: 'null', mode: 'date', toDate: true })
    assignedAt?: Date | null;
}
