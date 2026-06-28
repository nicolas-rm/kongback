import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';

@Controller('sub-companies')
export class SubCompaniesController {
    constructor(private readonly subCompaniesService: SubCompaniesService) {}

    @Post()
    @Permissions('sub-companies.create')
    create(@Body() dto: CreateSubCompanyDto) {
        return this.subCompaniesService.create(dto);
    }

    @Get()
    @Permissions('sub-companies.read-list')
    findAll(@Query() dto: FindSubCompaniesDto) {
        return this.subCompaniesService.findAll(dto);
    }

    @Get(':id')
    @Permissions('sub-companies.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.findOne(id);
    }

    @Patch(':id')
    @Permissions('sub-companies.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubCompanyDto) {
        return this.subCompaniesService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('sub-companies.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.deactivate(id);
    }
}
