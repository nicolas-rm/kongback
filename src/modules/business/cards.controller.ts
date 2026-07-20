import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { AssignCardsToSubCompanyDto, AssignCardVehicleDto, CreateCardDto, FindCardsDto, FindStatusRecordsDto, SyncSubCompanyCardsDto, UpdateCardDto } from '@/modules/business/dto';
import { CardsService } from '@/modules/business/services/cards.service';

@RequireCompany()
@Controller('cards')
export class CardsController {
    constructor(private readonly cardsService: CardsService) {}

    @Post()
    @Permissions('cards.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateCardDto) {
        return this.cardsService.create(dto, scope);
    }

    @Get()
    @Permissions('cards.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindCardsDto) {
        return this.cardsService.findAll(dto, scope);
    }

    @Get('by-design-fuel/:designFuelId')
    @Permissions('cards.design-fuel.read')
    findByDesignFuel(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('designFuelId', ParseUUIDPipe) designFuelId: string, @Query() dto: FindStatusRecordsDto) {
        return this.cardsService.findByDesignFuel(designFuelId, dto, scope);
    }

    @Post('assign-sub-company')
    @Permissions('cards.create')
    assignCardsToSubCompany(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: AssignCardsToSubCompanyDto) {
        return this.cardsService.assignCardsToSubCompany(dto, scope);
    }

    @Post('sync-sub-company')
    @Permissions('cards.sync')
    syncSubCompanyCards(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: SyncSubCompanyCardsDto) {
        return this.cardsService.syncSubCompanyCards(dto, scope);
    }

    @Get(':id')
    @Permissions('cards.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.findOne(id, scope);
    }

    @Patch(':id/assign-vehicle')
    @Permissions('cards.vehicle.assign')
    assignVehicle(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignCardVehicleDto) {
        return this.cardsService.assignVehicle(id, dto, scope);
    }

    @Patch(':id/unassign')
    @Permissions('cards.unassign')
    unassign(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.unassign(id, scope);
    }

    @Patch(':id')
    @Permissions('cards.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) {
        return this.cardsService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('cards.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.deactivate(id, scope);
    }
}
