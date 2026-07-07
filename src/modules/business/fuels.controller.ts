import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions, RequireSystemAccess } from '@/decorators';
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
