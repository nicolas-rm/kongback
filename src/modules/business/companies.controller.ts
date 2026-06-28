import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateCompanyDto, FindStatusRecordsDto, UpdateCompanyDto } from '@/modules/business/dto';
import { CompaniesService } from '@/modules/business/services/companies.service';

@Controller('companies')
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) {}

    @Post()
    @Permissions('companies.create')
    create(@Body() dto: CreateCompanyDto) {
        return this.companiesService.create(dto);
    }

    @Get()
    @Permissions('companies.read-list')
    findAll(@Query() dto: FindStatusRecordsDto) {
        return this.companiesService.findAll(dto);
    }

    @Get(':id')
    @Permissions('companies.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.findOne(id);
    }

    @Patch(':id')
    @Permissions('companies.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
        return this.companiesService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('companies.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.deactivate(id);
    }
}
