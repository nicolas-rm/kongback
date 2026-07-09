import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ValidatorBoolean, ValidatorEnum, ValidatorString, ValidatorUUID } from '@/decorators';
import { AddressDto } from '@/modules/business/dto/address.dto';

export class CreateSubCompanyDto {
    @ValidatorUUID()
    companyId!: string;

    @ValidatorString()
    key!: string;

    @ValidatorString()
    name!: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorBoolean({ optional: true })
    isDefault?: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}

export class UpdateSubCompanyDto {
    @ValidatorString({ optional: true })
    key?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    cardcloudSubaccountId?: string | null;

    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorBoolean({ optional: true })
    isDefault?: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}
