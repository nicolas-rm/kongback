import { Status } from '@prisma/client';
import { ValidatorEnum, ValidatorString } from '@/decorators';

export class CreateFuelDto {
    @ValidatorString({ toUpperCase: true })
    code!: string;

    @ValidatorString()
    name!: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}

export class UpdateFuelDto {
    @ValidatorString({ optional: true, toUpperCase: true })
    code?: string;

    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}
