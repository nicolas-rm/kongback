import { Status } from '@prisma/client';
import { ValidatorEnum, ValidatorNumber, ValidatorUUID } from '@/decorators';

export class CreateStationFuelDto {
    @ValidatorUUID()
    stationId!: string;

    @ValidatorUUID()
    fuelId!: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorNumber({ optional: true, type: 'float', min: 0 })
    price?: number;
}

export class UpdateStationFuelDto {
    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorNumber({ optional: true, type: 'float', min: 0 })
    price?: number;
}
