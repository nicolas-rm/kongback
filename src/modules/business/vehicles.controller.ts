import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateVehicleDto, FindVehiclesDto, SetVehicleDriverDto, UpdateVehicleDto } from '@/modules/business/dto';
import { VehiclesService } from '@/modules/business/services/vehicles.service';

@RequireOrganization()
@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) {}

    @Post()
    @Permissions('vehicles.create')
    create(@CurrentOrganizationId() organizationId: string, @Body() dto: CreateVehicleDto) {
        return this.vehiclesService.create(organizationId, dto);
    }

    @Get()
    @Permissions('vehicles.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @Query() dto: FindVehiclesDto) {
        return this.vehiclesService.findAll(organizationId, dto);
    }

    @Get(':id')
    @Permissions('vehicles.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.findOne(organizationId, id);
    }

    @Patch(':id/driver')
    @Permissions('vehicles.driver.assign')
    setDriver(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVehicleDriverDto) {
        return this.vehiclesService.setDriver(organizationId, id, dto);
    }

    @Patch(':id')
    @Permissions('vehicles.update')
    update(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
        return this.vehiclesService.update(organizationId, id, dto);
    }

    @Delete(':id')
    @Permissions('vehicles.delete')
    remove(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.deactivate(organizationId, id);
    }
}
