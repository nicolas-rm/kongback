import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { CreateCardcloudCardStockDto, FindCardcloudCardStockDto, UpdateCardcloudCardStockDto } from '@/modules/business/dto';
import { CardcloudCardStockService } from '@/modules/business/services/cardcloud-card-stock.service';

@RequireCompany()
@Controller('cardcloud-card-stock')
export class CardcloudCardStockController {
    constructor(private readonly cardcloudCardStockService: CardcloudCardStockService) {}

    @Post()
    @Permissions('cardcloud-card-stock.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.create(dto, companyId);
    }

    @Get()
    @Permissions('cardcloud-card-stock.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindCardcloudCardStockDto) {
        return this.cardcloudCardStockService.findAll(dto, companyId);
    }

    @Get(':id')
    @Permissions('cardcloud-card-stock.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.findOne(id, companyId);
    }

    @Patch(':id')
    @Permissions('cardcloud-card-stock.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('cardcloud-card-stock.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.deactivate(id, companyId);
    }
}
