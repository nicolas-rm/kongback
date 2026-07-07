import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';

@RequireCompany()
@Controller('sub-companies')
export class SubCompaniesController {
    constructor(private readonly subCompaniesService: SubCompaniesService) {}

    @Post()
    @Permissions('sub-companies.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateSubCompanyDto) {
        return this.subCompaniesService.create(dto, companyId);
    }

    @Get()
    @Permissions('sub-companies.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindSubCompaniesDto) {
        return this.subCompaniesService.findAll(dto, companyId);
    }

    @Get(':id')
    @Permissions('sub-companies.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.findOne(id, companyId);
    }

    @Patch(':id')
    @Permissions('sub-companies.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubCompanyDto) {
        return this.subCompaniesService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('sub-companies.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.deactivate(id, companyId);
    }
}
