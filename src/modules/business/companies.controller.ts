import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Permissions, RequireSystemAccess } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { setExcelAttachmentHeaders } from '@/utilities/export/excel-export';
import { CreateCompanyDto, FindStatusRecordsDto, UpdateCompanyDto } from '@/modules/business/dto';
import { CompaniesService } from '@/modules/business/services/companies.service';

@Controller('companies')
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) {}

    @Post()
    @Permissions('companies.create')
    @RequireSystemAccess()
    create(@Body() dto: CreateCompanyDto) {
        return this.companiesService.create(dto);
    }

    @Get()
    @Permissions('companies.read-list')
    findAll(@CurrentUser() user: RequestUser, @Query() dto: FindStatusRecordsDto) {
        return this.companiesService.findAll(dto, user);
    }

    @Get('export')
    @Permissions('companies.read-list')
    async exportList(@CurrentUser() user: RequestUser, @Query() dto: FindStatusRecordsDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.companiesService.exportList(dto, user);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id')
    @Permissions('companies.read-one')
    findOne(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.findOne(id, user);
    }

    @Patch(':id')
    @Permissions('companies.update')
    @RequireSystemAccess()
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
        return this.companiesService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('companies.delete')
    @RequireSystemAccess()
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.deactivate(id);
    }
}
