import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentCompanyScope, CurrentUser, Permissions, RequestConfig, RequireSystemAccess, RequireSystemOrCompanyAccess } from '@/decorators';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import {
    AssignCardcloudCardsBulkDto,
    AssignCardcloudCardsDto,
    CardcloudDateRangeQueryDto,
    CardcloudPageQueryDto,
    CreateCardcloudSubaccountDto,
    DownloadCardcloudTransferBulkExcelDto,
    TransferCardcloudFundsBulkDto,
    TransferCardcloudFundsBulkExcelDto,
    TransferCardcloudFundsDto,
    UpdateCardcloudCardNipDto,
    ValidateCardcloudCardDto,
} from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import type { UploadedFile as AppUploadedFile } from '@/modules/documents/types/uploaded-file.type';

@Controller('cardcloud')
export class CardcloudController {
    constructor(private readonly cardcloudService: CardcloudService) {}

    @Get('cards/movement/:uuid')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.movements.read-one')
    getCardMovement(@Param('uuid') uuid: string) {
        return this.cardcloudService.getCardMovement(uuid);
    }

    @Get('cards/:uuid')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.read-one')
    getCard(@Param('uuid') uuid: string) {
        return this.cardcloudService.getCard(uuid);
    }

    @Get('cards/:uuid/movements')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.movements.read-list')
    getCardMovements(@Param('uuid') uuid: string, @Query() query: CardcloudDateRangeQueryDto) {
        return this.cardcloudService.getCardMovements(uuid, query);
    }

    @Get('cards/:uuid/sensitive')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.sensitive.read-one')
    getCardSensitiveData(@Param('uuid') uuid: string) {
        return this.cardcloudService.getCardSensitiveData(uuid);
    }

    @Get('cards/:uuid/cvv')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.cvv.read')
    getCardCvv(@Param('uuid') uuid: string) {
        return this.cardcloudService.getCardCvv(uuid);
    }

    @Patch('cards/:uuid/nip')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.nip.update')
    @RequestConfig({ statusCode: HttpStatus.OK })
    updateCardNip(@Param('uuid') uuid: string, @Body() dto: UpdateCardcloudCardNipDto) {
        return this.cardcloudService.updateCardNip(uuid, dto);
    }

    @Post('cards/validate')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.validate')
    @RequestConfig({ statusCode: HttpStatus.OK })
    validateCard(@Body() dto: ValidateCardcloudCardDto) {
        return this.cardcloudService.validateCard(dto);
    }

    @Post('cards/:uuid/block')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.block')
    @RequestConfig({ statusCode: HttpStatus.OK })
    blockCard(@Param('uuid') uuid: string) {
        return this.cardcloudService.blockCard(uuid);
    }

    @Post('cards/:uuid/unblock')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.unblock')
    @RequestConfig({ statusCode: HttpStatus.OK })
    unblockCard(@Param('uuid') uuid: string) {
        return this.cardcloudService.unblockCard(uuid);
    }

    @Get('subaccounts')
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud.subaccounts.read-list')
    getSubaccounts(@CurrentCompanyScope() scope: CompanyScope | undefined) {
        return this.cardcloudService.getSubaccounts(scope);
    }

    @Get('subaccounts/:uuid')
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud.subaccounts.read-one')
    getSubaccount(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('uuid') uuid: string) {
        return this.cardcloudService.getSubaccount(uuid, scope);
    }

    @Get('subaccounts/:uuid/cards')
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud.subaccounts.cards.read-list')
    getSubaccountCards(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('uuid') uuid: string, @Query() query: CardcloudPageQueryDto) {
        return this.cardcloudService.getSubaccountCards(uuid, query, scope);
    }

    @Post('subaccounts')
    @RequireSystemAccess()
    @Permissions('cardcloud.subaccounts.create')
    createSubaccount(@Body() dto: CreateCardcloudSubaccountDto) {
        return this.cardcloudService.createSubaccount(dto);
    }

    @Get('subaccounts/:uuid/movements')
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud.subaccounts.movements.read-list')
    getSubaccountMovements(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('uuid') uuid: string, @Query() query: CardcloudDateRangeQueryDto) {
        return this.cardcloudService.getSubaccountMovements(uuid, query, scope);
    }

    @Post('account/cards/assign')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.assign')
    @RequestConfig({ statusCode: HttpStatus.OK })
    assignCards(@Body() dto: AssignCardcloudCardsDto) {
        return this.cardcloudService.assignCards(dto);
    }

    @Post('account/cards/assign-bulk')
    @RequireSystemAccess()
    @Permissions('cardcloud.cards.assign.bulk')
    @RequestConfig({ statusCode: HttpStatus.OK })
    assignCardsBulk(@Body() dto: AssignCardcloudCardsBulkDto) {
        return this.cardcloudService.assignCardsBulk(dto);
    }

    @Post('account/transfer')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.transfer')
    @RequestConfig({ statusCode: HttpStatus.OK })
    transferFunds(@CurrentUser() user: RequestUser, @Body() dto: TransferCardcloudFundsDto) {
        return this.cardcloudService.transferFunds(dto, user.id);
    }

    @Post('account/transfer-bulk')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.transfer.bulk')
    @RequestConfig({ statusCode: HttpStatus.OK })
    transferFundsBulk(@CurrentUser() user: RequestUser, @Body() dto: TransferCardcloudFundsBulkDto) {
        return this.cardcloudService.transferFundsBulk(dto, user.id);
    }

    @Get('account/transfer-bulk-excel')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.transfer.bulk')
    @RequestConfig({ statusCode: HttpStatus.OK })
    async downloadTransferFundsBulkExcelTemplate(@Query() dto: DownloadCardcloudTransferBulkExcelDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.cardcloudService.downloadTransferFundsBulkExcelTemplate(dto);
        response.setHeader('Content-Type', file.mimeType);
        response.setHeader('Content-Disposition', this.buildAttachmentDisposition(file.filename));
        response.setHeader('Content-Length', String(file.buffer.length));
        return new StreamableFile(file.buffer);
    }

    @Post('account/transfer-bulk-excel')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.transfer.bulk')
    @RequestConfig({ statusCode: HttpStatus.OK })
    @UseInterceptors(FileInterceptor('file'))
    transferFundsBulkExcel(@CurrentUser() user: RequestUser, @Body() dto: TransferCardcloudFundsBulkExcelDto, @UploadedFile() file?: AppUploadedFile) {
        return this.cardcloudService.transferFundsBulkExcel(dto, file, user.id);
    }

    @Get('account')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.read-one')
    getAccount() {
        return this.cardcloudService.getAccount();
    }

    @Get('account/movements')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.movements.read-list')
    getAccountMovements(@Query() query: CardcloudDateRangeQueryDto) {
        return this.cardcloudService.getAccountMovements(query);
    }

    private buildAttachmentDisposition(filename: string): string {
        const fallback = filename.replace(/["\\\r\n]/g, '_');
        return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    }
}
