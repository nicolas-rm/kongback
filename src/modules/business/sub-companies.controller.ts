import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';

@RequireOrganization()
@Controller('sub-companies')
export class SubCompaniesController {
    constructor(private readonly subCompaniesService: SubCompaniesService) {}

    @Post()
    @Permissions('sub-companies.create')
    create(@CurrentOrganizationId() organizationId: string, @Body() dto: CreateSubCompanyDto) {
        return this.subCompaniesService.create(organizationId, dto);
    }

    @Get()
    @Permissions('sub-companies.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @Query() dto: FindSubCompaniesDto) {
        return this.subCompaniesService.findAll(organizationId, dto);
    }

    @Get(':id')
    @Permissions('sub-companies.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.findOne(organizationId, id);
    }

    @Patch(':id')
    @Permissions('sub-companies.update')
    update(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubCompanyDto) {
        return this.subCompaniesService.update(organizationId, id, dto);
    }

    @Delete(':id')
    @Permissions('sub-companies.delete')
    remove(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.deactivate(organizationId, id);
    }
}
