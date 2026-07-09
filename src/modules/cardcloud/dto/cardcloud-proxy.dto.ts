import { Type } from 'class-transformer';
import { IsIn, IsString, ValidateNested } from 'class-validator';
import { ValidatorArray, ValidatorNumber, ValidatorString, ValidatorUUID } from '@/decorators';

const TRANSFER_ENTITY_TYPES = ['account', 'subaccount', 'card'] as const;
type TransferEntityType = (typeof TRANSFER_ENTITY_TYPES)[number];

export class CardcloudDateRangeQueryDto {
    @ValidatorString({ optional: true })
    from?: string;

    @ValidatorString({ optional: true })
    to?: string;
}

export class CardcloudPageQueryDto {
    @ValidatorString({ optional: true })
    page?: string;
}

export class CreateCardcloudSubaccountDto {
    @ValidatorString()
    ExternalId!: string;

    @ValidatorString()
    Description!: string;
}

export class AssignCardcloudSubCompanyDto {
    @ValidatorUUID()
    subCompanyId!: string;
}

export class AssignCardcloudCardsDto {
    @ValidatorString()
    subaccount_id!: string;

    @ValidatorString()
    card_type!: string;

    @ValidatorNumber({ min: 1 })
    quantity!: number;
}

export class AssignCardcloudCardsBulkDto {
    @ValidatorString()
    subaccount_id!: string;

    @ValidatorArray({ minSize: 1, unique: true })
    @IsString({ each: true })
    cards!: string[];
}

export class UpdateCardcloudCardNipDto {
    @ValidatorString()
    old_nip!: string;

    @ValidatorString()
    new_nip!: string;
}

export class ValidateCardcloudCardDto {
    @ValidatorString()
    card!: string;

    @ValidatorString()
    pin!: string;

    @ValidatorString()
    moye!: string;
}

export class TransferCardcloudFundsDto {
    @ValidatorString({ toLowerCase: true })
    @IsIn(TRANSFER_ENTITY_TYPES)
    sourceType!: TransferEntityType;

    @ValidatorString()
    source!: string;

    @ValidatorString({ toLowerCase: true })
    @IsIn(TRANSFER_ENTITY_TYPES)
    destinationType!: TransferEntityType;

    @ValidatorString()
    destination!: string;

    @ValidatorNumber({ type: 'float' })
    amount!: number;

    @ValidatorString()
    description!: string;
}

export class TransferCardcloudFundsBulkDto {
    @ValidatorArray({ minSize: 1, maxSize: 50 })
    @ValidateNested({ each: true })
    @Type(() => TransferCardcloudFundsDto)
    transfers!: TransferCardcloudFundsDto[];
}
