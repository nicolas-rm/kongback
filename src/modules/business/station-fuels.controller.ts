import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { StationFuelsService } from '@/modules/business/services/station-fuels.service';

@RequireOrganization()
@Controller('station-fuels')
export class StationFuelsController {
    constructor(private readonly stationFuelsService: StationFuelsService) {}

    @Post()
    @Permissions('station-fuels.create')
    create(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateStationFuelDto) {
        return this.stationFuelsService.create(organizationId, dto, companyId);
    }

    @Get()
    @Permissions('station-fuels.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindStationFuelsDto) {
        return this.stationFuelsService.findAll(organizationId, dto, companyId);
    }

    @Get(':id')
    @Permissions('station-fuels.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.findOne(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('station-fuels.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationFuelDto) {
        return this.stationFuelsService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('station-fuels.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.deactivate(organizationId, id, companyId);
    }
}
