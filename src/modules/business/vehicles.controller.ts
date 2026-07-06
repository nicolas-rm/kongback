import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateVehicleDto, FindVehiclesDto, SetVehicleDriverDto, UpdateVehicleDto } from '@/modules/business/dto';
import { VehiclesService } from '@/modules/business/services/vehicles.service';

@RequireOrganization()
@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) {}

    @Post()
    @Permissions('vehicles.create')
    create(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateVehicleDto) {
        return this.vehiclesService.create(organizationId, dto, companyId);
    }

    @Get()
    @Permissions('vehicles.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindVehiclesDto) {
        return this.vehiclesService.findAll(organizationId, dto, companyId);
    }

    @Get(':id')
    @Permissions('vehicles.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.findOne(organizationId, id, companyId);
    }

    @Patch(':id/driver')
    @Permissions('vehicles.driver.assign')
    setDriver(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVehicleDriverDto) {
        return this.vehiclesService.setDriver(organizationId, id, dto, companyId);
    }

    @Patch(':id')
    @Permissions('vehicles.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
        return this.vehiclesService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('vehicles.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.deactivate(organizationId, id, companyId);
    }
}
