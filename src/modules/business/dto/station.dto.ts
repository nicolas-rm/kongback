import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ValidatorEnum, ValidatorNumber, ValidatorString, ValidatorUUID } from '@/decorators';
import { AddressDto } from '@/modules/business/dto/address.dto';

export class CreateStationDto {
    @ValidatorUUID()
    subCompanyId!: string;

    @ValidatorString()
    stationNumber!: string;

    @ValidatorString()
    name!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    legalName?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null', toUpperCase: true })
    taxId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    sic?: string | null;

    @ValidatorNumber({ optional: true, type: 'float', min: -90, max: 90 })
    lat?: number;

    @ValidatorNumber({ optional: true, type: 'float', min: -180, max: 180 })
    lon?: number;

    @ValidatorNumber({ optional: true, type: 'float', min: 0 })
    commissionPercent?: number;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}

export class UpdateStationDto {
    @ValidatorString({ optional: true })
    stationNumber?: string;

    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    legalName?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null', toUpperCase: true })
    taxId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    sic?: string | null;

    @ValidatorNumber({ optional: true, type: 'float', min: -90, max: 90 })
    lat?: number;

    @ValidatorNumber({ optional: true, type: 'float', min: -180, max: 180 })
    lon?: number;

    @ValidatorNumber({ optional: true, type: 'float', min: 0 })
    commissionPercent?: number;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;
}
