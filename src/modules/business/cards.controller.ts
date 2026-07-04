import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { AssignCardVehicleDto, CreateCardDto, FindCardsDto, FindStatusRecordsDto, UpdateCardDto } from '@/modules/business/dto';
import { CardsService } from '@/modules/business/services/cards.service';

@Controller('cards')
export class CardsController {
    constructor(private readonly cardsService: CardsService) {}

    @Post()
    @Permissions('cards.create')
    create(@Body() dto: CreateCardDto) {
        return this.cardsService.create(dto);
    }

    @Get()
    @Permissions('cards.read-list')
    findAll(@Query() dto: FindCardsDto) {
        return this.cardsService.findAll(dto);
    }

    @Get('by-design-fuel/:designFuelId')
    @Permissions('cards.design-fuel.read')
    findByDesignFuel(@Param('designFuelId', ParseUUIDPipe) designFuelId: string, @Query() dto: FindStatusRecordsDto) {
        return this.cardsService.findByDesignFuel(designFuelId, dto);
    }

    @Get(':id')
    @Permissions('cards.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.findOne(id);
    }

    @Patch(':id/assign-vehicle')
    @Permissions('cards.vehicle.assign')
    assignVehicle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignCardVehicleDto) {
        return this.cardsService.assignVehicle(id, dto);
    }

    @Patch(':id/unassign')
    @Permissions('cards.unassign')
    unassign(@Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.unassign(id);
    }

    @Patch(':id')
    @Permissions('cards.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) {
        return this.cardsService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('cards.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.deactivate(id);
    }
}
