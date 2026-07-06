import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateCardcloudCardStockDto, FindCardcloudCardStockDto, UpdateCardcloudCardStockDto } from '@/modules/business/dto';
import { CardcloudCardStockService } from '@/modules/business/services/cardcloud-card-stock.service';

@RequireOrganization()
@Controller('cardcloud-card-stock')
export class CardcloudCardStockController {
    constructor(private readonly cardcloudCardStockService: CardcloudCardStockService) {}

    @Post()
    @Permissions('cardcloud-card-stock.create')
    create(@CurrentOrganizationId() organizationId: string, @Body() dto: CreateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.create(organizationId, dto);
    }

    @Get()
    @Permissions('cardcloud-card-stock.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @Query() dto: FindCardcloudCardStockDto) {
        return this.cardcloudCardStockService.findAll(organizationId, dto);
    }

    @Get(':id')
    @Permissions('cardcloud-card-stock.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.findOne(organizationId, id);
    }

    @Patch(':id')
    @Permissions('cardcloud-card-stock.update')
    update(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.update(organizationId, id, dto);
    }

    @Delete(':id')
    @Permissions('cardcloud-card-stock.delete')
    remove(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.deactivate(organizationId, id);
    }
}
