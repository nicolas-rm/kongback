import { Type } from 'class-transformer';
import { IsIn, IsString, ValidateNested } from 'class-validator';
import { ValidatorArray, ValidatorNumber, ValidatorString, ValidatorUUID } from '@/decorators';
import { CARDCLOUD_TRANSFER_ENTITY_TYPES, type CardcloudTransferEntityType } from '@/modules/cardcloud/types/cardcloud-provider.types';
import { ExportQueryDto } from '@/utilities/export/export-query.dto';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';

export class CardcloudDateRangeQueryDto extends ExportQueryDto {
    @ValidatorString({ optional: true })
    from?: string;

    @ValidatorString({ optional: true })
    to?: string;
}

export class CardcloudPageQueryDto extends ExportQueryDto {
    @ValidatorString({ optional: true })
    page?: string;
}

export class FindCardcloudStockDto extends PaginationDto {
    @ValidatorString({ optional: true })
    providerStatus?: string;

    @ValidatorUUID({ optional: true })
    subCompanyId?: string;
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
    @IsIn(CARDCLOUD_TRANSFER_ENTITY_TYPES)
    sourceType!: CardcloudTransferEntityType;

    @ValidatorString()
    source!: string;

    @ValidatorString({ toLowerCase: true })
    @IsIn(CARDCLOUD_TRANSFER_ENTITY_TYPES)
    destinationType!: CardcloudTransferEntityType;

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

export class DownloadCardcloudTransferBulkExcelDto {
    @ValidatorUUID({ optional: true })
    subCompanyId?: string;
}

export class TransferCardcloudFundsBulkExcelDto {
    @ValidatorUUID()
    subCompanyId!: string;
}
