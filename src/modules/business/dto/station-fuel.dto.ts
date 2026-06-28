import { Status } from '@prisma/client';
import { ValidatorEnum, ValidatorUUID } from '@/decorators';

export class CreateStationFuelDto {
    @ValidatorUUID()
    stationId!: string;

    @ValidatorUUID()
    fuelId!: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}

export class UpdateStationFuelDto {
    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}
