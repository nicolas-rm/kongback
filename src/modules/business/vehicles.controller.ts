import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateVehicleDto, FindVehiclesDto, SetVehicleDriverDto, UpdateVehicleDto } from '@/modules/business/dto';
import { VehiclesService } from '@/modules/business/services/vehicles.service';

@RequireCompany()
@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) {}

    @Post()
    @Permissions('vehicles.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateVehicleDto) {
        return this.vehiclesService.create(dto, scope);
    }

    @Get()
    @Permissions('vehicles.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindVehiclesDto) {
        return this.vehiclesService.findAll(dto, scope);
    }

    @Get(':id')
    @Permissions('vehicles.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.findOne(id, scope);
    }

    @Patch(':id/driver')
    @Permissions('vehicles.driver.assign')
    setDriver(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVehicleDriverDto) {
        return this.vehiclesService.setDriver(id, dto, scope);
    }

    @Patch(':id')
    @Permissions('vehicles.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
        return this.vehiclesService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('vehicles.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.deactivate(id, scope);
    }
}
