import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequestConfig, RequireCompany, RequireSystemAccess } from '@/decorators';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import {
    AssignCardcloudCardsBulkDto,
    AssignCardcloudCardsDto,
    AssignCardcloudSubCompanyDto,
    CardcloudDateRangeQueryDto,
    CardcloudPageQueryDto,
    CreateCardcloudSubaccountDto,
    TransferCardcloudFundsBulkDto,
    TransferCardcloudFundsDto,
    UpdateCardcloudCardNipDto,
    ValidateCardcloudCardDto,
} from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

@Controller('cardcloud')
export class CardcloudController {
    constructor(private readonly cardcloudService: CardcloudService) {}

    @Post('sync')
    @RequireSystemAccess()
    @Permissions('cardcloud.sync')
    @RequestConfig({ statusCode: HttpStatus.OK })
    sync() {
        return this.cardcloudService.syncStock();
    }

    @Patch(':id/assign-sub-company')
    @RequireCompany()
    @Permissions('cardcloud.sub-company.assign')
    @RequestConfig({ statusCode: HttpStatus.OK })
    assignSubCompany(
        @Param('id') id: string,
        @Body() dto: AssignCardcloudSubCompanyDto,
        @CurrentCompanyScope() scope: CompanyScope | undefined
    ) {
        return this.cardcloudService.assignSubCompany(id, dto, scope);
    }

    @Patch(':id/unassign-sub-company')
    @RequireCompany()
    @Permissions('cardcloud.sub-company.unassign')
    @RequestConfig({ statusCode: HttpStatus.OK })
    unassignSubCompany(
        @Param('id') id: string,
        @CurrentCompanyScope() scope: CompanyScope | undefined
    ) {
        return this.cardcloudService.unassignSubCompany(id, scope);
    }

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
    @RequireSystemAccess()
    @Permissions('cardcloud.subaccounts.read-list')
    getSubaccounts() {
        return this.cardcloudService.getSubaccounts();
    }

    @Get('subaccounts/:uuid')
    @RequireSystemAccess()
    @Permissions('cardcloud.subaccounts.read-one')
    getSubaccount(@Param('uuid') uuid: string) {
        return this.cardcloudService.getSubaccount(uuid);
    }

    @Get('subaccounts/:uuid/cards')
    @RequireSystemAccess()
    @Permissions('cardcloud.subaccounts.cards.read-list')
    getSubaccountCards(@Param('uuid') uuid: string, @Query() query: CardcloudPageQueryDto) {
        return this.cardcloudService.getSubaccountCards(uuid, query);
    }

    @Post('subaccounts')
    @RequireSystemAccess()
    @Permissions('cardcloud.subaccounts.create')
    createSubaccount(@Body() dto: CreateCardcloudSubaccountDto) {
        return this.cardcloudService.createSubaccount(dto);
    }

    @Get('subaccounts/:uuid/movements')
    @RequireSystemAccess()
    @Permissions('cardcloud.subaccounts.movements.read-list')
    getSubaccountMovements(@Param('uuid') uuid: string, @Query() query: CardcloudDateRangeQueryDto) {
        return this.cardcloudService.getSubaccountMovements(uuid, query);
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
    transferFunds(@Body() dto: TransferCardcloudFundsDto) {
        return this.cardcloudService.transferFunds(dto);
    }

    @Post('account/transfer-bulk')
    @RequireSystemAccess()
    @Permissions('cardcloud.account.transfer.bulk')
    @RequestConfig({ statusCode: HttpStatus.OK })
    transferFundsBulk(@Body() dto: TransferCardcloudFundsBulkDto) {
        return this.cardcloudService.transferFundsBulk(dto);
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
}
