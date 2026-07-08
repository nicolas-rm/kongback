import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';

@RequireCompany()
@Controller('sub-companies')
export class SubCompaniesController {
    constructor(private readonly subCompaniesService: SubCompaniesService) {}

    @Post()
    @Permissions('sub-companies.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateSubCompanyDto) {
        return this.subCompaniesService.create(dto, scope);
    }

    @Get()
    @Permissions('sub-companies.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindSubCompaniesDto) {
        return this.subCompaniesService.findAll(dto, scope);
    }

    @Get(':id')
    @Permissions('sub-companies.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('sub-companies.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubCompanyDto) {
        return this.subCompaniesService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('sub-companies.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.deactivate(id, scope);
    }
}
