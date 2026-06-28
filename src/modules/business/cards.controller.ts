import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateCardDto, FindCardsDto, UpdateCardDto } from '@/modules/business/dto';
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

    @Get(':id')
    @Permissions('cards.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.findOne(id);
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
