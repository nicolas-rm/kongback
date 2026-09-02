import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { Permissions, RequireSystemAccess } from '@/decorators';
import { setExcelAttachmentHeaders } from '@/utilities/export/excel-export';
import { CreateFuelDto, FindStatusRecordsDto, UpdateFuelDto } from '@/modules/business/dto';
import { FuelsService } from '@/modules/business/services/fuels.service';

@Controller('fuels')
export class FuelsController {
    constructor(private readonly fuelsService: FuelsService) {}

    @Post()
    @Permissions('fuels.create')
    @RequireSystemAccess()
    create(@Body() dto: CreateFuelDto) {
        return this.fuelsService.create(dto);
    }

    @Get()
    @Permissions('fuels.read-list')
    findAll(@Query() dto: FindStatusRecordsDto) {
        return this.fuelsService.findAll(dto);
    }

    @Get('export')
    @Permissions('fuels.read-list')
    async exportList(@Query() dto: FindStatusRecordsDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.fuelsService.exportList(dto);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id')
    @Permissions('fuels.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.fuelsService.findOne(id);
    }

    @Patch(':id')
    @Permissions('fuels.update')
    @RequireSystemAccess()
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFuelDto) {
        return this.fuelsService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('fuels.delete')
    @RequireSystemAccess()
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.fuelsService.deactivate(id);
    }
}
