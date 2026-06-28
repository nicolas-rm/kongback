import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateCardcloudCardStockDto, FindCardcloudCardStockDto, UpdateCardcloudCardStockDto } from '@/modules/business/dto';
import { CardcloudCardStockService } from '@/modules/business/services/cardcloud-card-stock.service';

@Controller('cardcloud-card-stock')
export class CardcloudCardStockController {
    constructor(private readonly cardcloudCardStockService: CardcloudCardStockService) {}

    @Post()
    @Permissions('cardcloud-card-stock.create')
    create(@Body() dto: CreateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.create(dto);
    }

    @Get()
    @Permissions('cardcloud-card-stock.read-list')
    findAll(@Query() dto: FindCardcloudCardStockDto) {
        return this.cardcloudCardStockService.findAll(dto);
    }

    @Get(':id')
    @Permissions('cardcloud-card-stock.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.findOne(id);
    }

    @Patch(':id')
    @Permissions('cardcloud-card-stock.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('cardcloud-card-stock.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.deactivate(id);
    }
}
