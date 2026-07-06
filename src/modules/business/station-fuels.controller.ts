import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { StationFuelsService } from '@/modules/business/services/station-fuels.service';

@RequireOrganization()
@Controller('station-fuels')
export class StationFuelsController {
    constructor(private readonly stationFuelsService: StationFuelsService) {}

    @Post()
    @Permissions('station-fuels.create')
    create(@CurrentOrganizationId() organizationId: string, @Body() dto: CreateStationFuelDto) {
        return this.stationFuelsService.create(organizationId, dto);
    }

    @Get()
    @Permissions('station-fuels.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @Query() dto: FindStationFuelsDto) {
        return this.stationFuelsService.findAll(organizationId, dto);
    }

    @Get(':id')
    @Permissions('station-fuels.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.findOne(organizationId, id);
    }

    @Patch(':id')
    @Permissions('station-fuels.update')
    update(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationFuelDto) {
        return this.stationFuelsService.update(organizationId, id, dto);
    }

    @Delete(':id')
    @Permissions('station-fuels.delete')
    remove(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.deactivate(organizationId, id);
    }
}
