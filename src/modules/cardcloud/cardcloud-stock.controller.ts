import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequestConfig, RequireSystemAccess, RequireSystemOrCompanyAccess } from '@/decorators';
import { AssignCardcloudSubCompanyDto, FindCardcloudStockDto } from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

@Controller('cardcloud-stock')
export class CardcloudStockController {
    constructor(private readonly cardcloudService: CardcloudService) {}

    @Get()
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud-stock.read-list')
    findStock(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindCardcloudStockDto) {
        return this.cardcloudService.findStock(dto, scope);
    }

    @Post('sync')
    @RequireSystemAccess()
    @Permissions('cardcloud-stock.sync')
    @RequestConfig({ statusCode: HttpStatus.OK })
    sync() {
        return this.cardcloudService.syncStock();
    }

    @Patch(':id/assign-sub-company')
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud-stock.sub-company.assign')
    @RequestConfig({ statusCode: HttpStatus.OK })
    assignSubCompany(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id') id: string, @Body() dto: AssignCardcloudSubCompanyDto) {
        return this.cardcloudService.assignSubCompany(id, dto, scope);
    }

    @Patch(':id/unassign-sub-company')
    @RequireSystemOrCompanyAccess()
    @Permissions('cardcloud-stock.sub-company.unassign')
    @RequestConfig({ statusCode: HttpStatus.OK })
    unassignSubCompany(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id') id: string) {
        return this.cardcloudService.unassignSubCompany(id, scope);
    }
}
