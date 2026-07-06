import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';

@RequireOrganization()
@Controller('sub-companies')
export class SubCompaniesController {
    constructor(private readonly subCompaniesService: SubCompaniesService) {}

    @Post()
    @Permissions('sub-companies.create')
    create(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateSubCompanyDto) {
        return this.subCompaniesService.create(organizationId, dto, companyId);
    }

    @Get()
    @Permissions('sub-companies.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindSubCompaniesDto) {
        return this.subCompaniesService.findAll(organizationId, dto, companyId);
    }

    @Get(':id')
    @Permissions('sub-companies.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.findOne(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('sub-companies.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubCompanyDto) {
        return this.subCompaniesService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('sub-companies.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.deactivate(organizationId, id, companyId);
    }
}
