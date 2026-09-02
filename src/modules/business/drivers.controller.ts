import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { setExcelAttachmentHeaders } from '@/utilities/export/excel-export';
import { CreateDriverDto, FindDriversDto, FindStatusRecordsDto, UpdateDriverDto } from '@/modules/business/dto';
import { DriversService } from '@/modules/business/services/drivers.service';

@RequireCompany()
@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @Post()
    @Permissions('drivers.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateDriverDto) {
        return this.driversService.create(dto, scope);
    }

    @Get()
    @Permissions('drivers.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindDriversDto) {
        return this.driversService.findAll(dto, scope);
    }

    @Get('export')
    @Permissions('drivers.read-list')
    async exportList(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindDriversDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.driversService.exportList(dto, scope);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id/vehicles')
    @Permissions('drivers.vehicles.read-list')
    findVehicles(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Query() dto: FindStatusRecordsDto) {
        return this.driversService.findVehicles(id, dto, scope);
    }

    @Get(':id/vehicles/export')
    @Permissions('drivers.vehicles.read-list')
    async exportVehicles(
        @CurrentCompanyScope() scope: CompanyScope | undefined,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() dto: FindStatusRecordsDto,
        @Res({ passthrough: true }) response: Response
    ) {
        const file = await this.driversService.exportVehicles(id, dto, scope);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id')
    @Permissions('drivers.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('drivers.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
        return this.driversService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('drivers.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.deactivate(id, scope);
    }
}
