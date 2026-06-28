import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateVehicleDto, FindVehiclesDto, UpdateVehicleDto } from '@/modules/business/dto';
import { VehiclesService } from '@/modules/business/services/vehicles.service';

@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) {}

    @Post()
    @Permissions('vehicles.create')
    create(@Body() dto: CreateVehicleDto) {
        return this.vehiclesService.create(dto);
    }

    @Get()
    @Permissions('vehicles.read-list')
    findAll(@Query() dto: FindVehiclesDto) {
        return this.vehiclesService.findAll(dto);
    }

    @Get(':id')
    @Permissions('vehicles.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.findOne(id);
    }

    @Patch(':id')
    @Permissions('vehicles.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
        return this.vehiclesService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('vehicles.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.deactivate(id);
    }
}
