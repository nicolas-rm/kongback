import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { StationFuelsService } from '@/modules/business/services/station-fuels.service';

@Controller('station-fuels')
export class StationFuelsController {
    constructor(private readonly stationFuelsService: StationFuelsService) {}

    @Post()
    @Permissions('station-fuels.create')
    create(@Body() dto: CreateStationFuelDto) {
        return this.stationFuelsService.create(dto);
    }

    @Get()
    @Permissions('station-fuels.read-list')
    findAll(@Query() dto: FindStationFuelsDto) {
        return this.stationFuelsService.findAll(dto);
    }

    @Get(':id')
    @Permissions('station-fuels.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.findOne(id);
    }

    @Patch(':id')
    @Permissions('station-fuels.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationFuelDto) {
        return this.stationFuelsService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('station-fuels.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.deactivate(id);
    }
}
