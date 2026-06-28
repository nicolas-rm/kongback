import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateDriverDto, FindDriversDto, UpdateDriverDto } from '@/modules/business/dto';
import { DriversService } from '@/modules/business/services/drivers.service';

@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @Post()
    @Permissions('drivers.create')
    create(@Body() dto: CreateDriverDto) {
        return this.driversService.create(dto);
    }

    @Get()
    @Permissions('drivers.read-list')
    findAll(@Query() dto: FindDriversDto) {
        return this.driversService.findAll(dto);
    }

    @Get(':id')
    @Permissions('drivers.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.findOne(id);
    }

    @Patch(':id')
    @Permissions('drivers.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
        return this.driversService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('drivers.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.deactivate(id);
    }
}
