import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateStationDto, FindStationsDto, UpdateStationDto } from '@/modules/business/dto';
import { StationsService } from '@/modules/business/services/stations.service';

@RequireOrganization()
@Controller('stations')
export class StationsController {
    constructor(private readonly stationsService: StationsService) {}

    @Post()
    @Permissions('stations.create')
    create(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateStationDto) {
        return this.stationsService.create(organizationId, dto, companyId);
    }

    @Get()
    @Permissions('stations.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindStationsDto) {
        return this.stationsService.findAll(organizationId, dto, companyId);
    }

    @Get(':id')
    @Permissions('stations.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.findOne(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('stations.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationDto) {
        return this.stationsService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('stations.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.deactivate(organizationId, id, companyId);
    }
}
