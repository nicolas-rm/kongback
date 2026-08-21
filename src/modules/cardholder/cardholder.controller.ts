import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, RequestConfig } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CardcloudDateRangeQueryDto } from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import { CardholderService } from '@/modules/cardholder/cardholder.service';
import { FindCardholderVehiclesDto, UpdateCardholderCardNipDto, ValidateCardholderCardDto } from '@/modules/cardholder/dto';

@Controller('cardholder')
export class CardholderController {
    constructor(private readonly cardholderService: CardholderService) {}

    @Get('me')
    @Permissions('cardholder.profile.read')
    getProfile(@CurrentUser() user: RequestUser) {
        return this.cardholderService.getProfile(user);
    }

    @Get('sub-company')
    @Permissions('cardholder.sub-companies.read-one')
    findMySubCompany(@CurrentUser() user: RequestUser) {
        return this.cardholderService.findMySubCompany(user);
    }

    @Get('vehicles')
    @Permissions('cardholder.vehicles.read-list')
    findMyVehicles(@CurrentUser() user: RequestUser, @Query() dto: FindCardholderVehiclesDto) {
        return this.cardholderService.findMyVehicles(user, dto);
    }

    @Get('cards')
    @Permissions('cardholder.cards.read-list')
    findMyCards(@CurrentUser() user: RequestUser) {
        return this.cardholderService.findMyCards(user);
    }

    @Post('cards/validate')
    @Permissions('cardholder.cards.validate')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 10, ttl: 60_000 } })
    validatePhysicalCard(@CurrentUser() user: RequestUser, @Body() dto: ValidateCardholderCardDto) {
        return this.cardholderService.validatePhysicalCard(user, dto);
    }

    @Get('cards/:cardId')
    @Permissions('cardholder.cards.read-one')
    findMyCard(@CurrentUser() user: RequestUser, @Param('cardId', ParseUUIDPipe) cardId: string) {
        return this.cardholderService.findMyCard(user, cardId);
    }

    @Post('cards/:cardId/off')
    @Permissions('cardholder.cards.power.off')
    @RequestConfig({ statusCode: HttpStatus.OK })
    powerOff(@CurrentUser() user: RequestUser, @Param('cardId', ParseUUIDPipe) cardId: string) {
        return this.cardholderService.powerOff(user, cardId);
    }

    @Post('cards/:cardId/on')
    @Permissions('cardholder.cards.power.on')
    @RequestConfig({ statusCode: HttpStatus.OK })
    powerOn(@CurrentUser() user: RequestUser, @Param('cardId', ParseUUIDPipe) cardId: string) {
        return this.cardholderService.powerOn(user, cardId);
    }

    @Get('cards/:cardId/movements')
    @Permissions('cardholder.cards.movements.read-list')
    getMovements(@CurrentUser() user: RequestUser, @Param('cardId', ParseUUIDPipe) cardId: string, @Query() query: CardcloudDateRangeQueryDto) {
        return this.cardholderService.getMovements(user, cardId, query);
    }

    @Get('cards/:cardId/sensitive')
    @Permissions('cardholder.cards.sensitive.read-one')
    getSensitiveData(@CurrentUser() user: RequestUser, @Param('cardId', ParseUUIDPipe) cardId: string) {
        return this.cardholderService.getSensitiveData(user, cardId);
    }

    @Patch('cards/:cardId/nip')
    @Permissions('cardholder.cards.nip.update')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    updateNip(@CurrentUser() user: RequestUser, @Param('cardId', ParseUUIDPipe) cardId: string, @Body() dto: UpdateCardholderCardNipDto) {
        return this.cardholderService.updateNip(user, cardId, dto);
    }
}
