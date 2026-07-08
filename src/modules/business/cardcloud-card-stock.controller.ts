import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateCardcloudCardStockDto, FindCardcloudCardStockDto, UpdateCardcloudCardStockDto } from '@/modules/business/dto';
import { CardcloudCardStockService } from '@/modules/business/services/cardcloud-card-stock.service';

@RequireCompany()
@Controller('cardcloud-card-stock')
export class CardcloudCardStockController {
    constructor(private readonly cardcloudCardStockService: CardcloudCardStockService) {}

    @Post()
    @Permissions('cardcloud-card-stock.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.create(dto, scope);
    }

    @Get()
    @Permissions('cardcloud-card-stock.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindCardcloudCardStockDto) {
        return this.cardcloudCardStockService.findAll(dto, scope);
    }

    @Get(':id')
    @Permissions('cardcloud-card-stock.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('cardcloud-card-stock.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardcloudCardStockDto) {
        return this.cardcloudCardStockService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('cardcloud-card-stock.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardcloudCardStockService.deactivate(id, scope);
    }
}
