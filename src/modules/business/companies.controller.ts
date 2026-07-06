import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateCompanyDto, FindStatusRecordsDto, UpdateCompanyDto } from '@/modules/business/dto';
import { CompaniesService } from '@/modules/business/services/companies.service';

@RequireOrganization()
@Controller('companies')
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) {}

    @Post()
    @Permissions('companies.create')
    create(@CurrentOrganizationId() organizationId: string, @Body() dto: CreateCompanyDto) {
        return this.companiesService.create(organizationId, dto);
    }

    @Get()
    @Permissions('companies.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @Query() dto: FindStatusRecordsDto) {
        return this.companiesService.findAll(organizationId, dto);
    }

    @Get(':id')
    @Permissions('companies.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.findOne(organizationId, id);
    }

    @Patch(':id')
    @Permissions('companies.update')
    update(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
        return this.companiesService.update(organizationId, id, dto);
    }

    @Delete(':id')
    @Permissions('companies.delete')
    remove(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.deactivate(organizationId, id);
    }
}
