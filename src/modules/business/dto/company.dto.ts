import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ValidatorEnum, ValidatorString } from '@/decorators';
import { AddressDto } from '@/modules/business/dto/address.dto';

export class CreateCompanyDto {
    @ValidatorString()
    key!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalId?: string | null;

    @ValidatorString()
    name!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    tradeName?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}

export class UpdateCompanyDto {
    @ValidatorString({ optional: true })
    key?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    externalId?: string | null;

    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    tradeName?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}
