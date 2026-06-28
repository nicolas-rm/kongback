import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ValidatorEnum, ValidatorString, ValidatorUUID } from '@/decorators';
import { AddressDto } from '@/modules/business/dto/address.dto';

export class CreateDriverDto {
    @ValidatorUUID()
    subCompanyId!: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    userId?: string | null;

    @ValidatorString()
    name!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalReference?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}

export class UpdateDriverDto {
    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    userId?: string | null;

    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalReference?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}
