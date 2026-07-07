import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { AssignCardVehicleDto, CreateCardDto, FindCardsDto, FindStatusRecordsDto, UpdateCardDto } from '@/modules/business/dto';
import { CardsService } from '@/modules/business/services/cards.service';

@RequireCompany()
@Controller('cards')
export class CardsController {
    constructor(private readonly cardsService: CardsService) {}

    @Post()
    @Permissions('cards.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateCardDto) {
        return this.cardsService.create(dto, companyId);
    }

    @Get()
    @Permissions('cards.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindCardsDto) {
        return this.cardsService.findAll(dto, companyId);
    }

    @Get('by-design-fuel/:designFuelId')
    @Permissions('cards.design-fuel.read')
    findByDesignFuel(@CurrentCompanyId() companyId: string | undefined, @Param('designFuelId', ParseUUIDPipe) designFuelId: string, @Query() dto: FindStatusRecordsDto) {
        return this.cardsService.findByDesignFuel(designFuelId, dto, companyId);
    }

    @Get(':id')
    @Permissions('cards.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.findOne(id, companyId);
    }

    @Patch(':id/assign-vehicle')
    @Permissions('cards.vehicle.assign')
    assignVehicle(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignCardVehicleDto) {
        return this.cardsService.assignVehicle(id, dto, companyId);
    }

    @Patch(':id/unassign')
    @Permissions('cards.unassign')
    unassign(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.unassign(id, companyId);
    }

    @Patch(':id')
    @Permissions('cards.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) {
        return this.cardsService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('cards.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.deactivate(id, companyId);
    }
}
