import { Status } from '@prisma/client';
import { IsDefined, ValidateIf } from 'class-validator';
import { ValidatorBoolean, ValidatorEnum, ValidatorNumber, ValidatorString, ValidatorUUID } from '@/decorators';

export class CreateVehicleDto {
    @ValidatorUUID()
    subCompanyId!: string;

    @ValidatorUUID()
    fuelId!: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    driverId?: string | null;

    @ValidatorString({ toUpperCase: true })
    plates!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    economicNumber?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    model?: string | null;

    @ValidatorNumber({ optional: true, min: 1900, max: 2100 })
    year?: number;

    @ValidatorBoolean({ optional: true })
    odometerControl?: boolean;

    @ValidatorNumber({ optional: true, min: 0 })
    odometerInitial?: number;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}

export class UpdateVehicleDto {
    @ValidatorUUID({ optional: true })
    fuelId?: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    driverId?: string | null;

    @ValidatorString({ optional: true, toUpperCase: true })
    plates?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    economicNumber?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    model?: string | null;

    @ValidatorNumber({ optional: true, min: 1900, max: 2100 })
    year?: number;

    @ValidatorBoolean({ optional: true })
    odometerControl?: boolean;

    @ValidatorNumber({ optional: true, min: 0 })
    odometerInitial?: number;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}

export class SetVehicleDriverDto {
    @IsDefined()
    @ValidateIf((_object, value) => value !== null)
    @ValidatorUUID({ emptyTo: 'null' })
    driverId!: string | null;
}
