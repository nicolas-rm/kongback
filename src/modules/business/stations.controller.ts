import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { CreateStationDto, FindStationsDto, UpdateStationDto } from '@/modules/business/dto';
import { StationsService } from '@/modules/business/services/stations.service';

@Controller('stations')
export class StationsController {
    constructor(private readonly stationsService: StationsService) {}

    @Post()
    @Permissions('stations.create')
    create(@Body() dto: CreateStationDto) {
        return this.stationsService.create(dto);
    }

    @Get()
    @Permissions('stations.read-list')
    findAll(@Query() dto: FindStationsDto) {
        return this.stationsService.findAll(dto);
    }

    @Get(':id')
    @Permissions('stations.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.findOne(id);
    }

    @Patch(':id')
    @Permissions('stations.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationDto) {
        return this.stationsService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('stations.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.deactivate(id);
    }
}
