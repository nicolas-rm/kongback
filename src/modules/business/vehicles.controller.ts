import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { CreateVehicleDto, FindVehiclesDto, SetVehicleDriverDto, UpdateVehicleDto } from '@/modules/business/dto';
import { VehiclesService } from '@/modules/business/services/vehicles.service';

@RequireCompany()
@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) {}

    @Post()
    @Permissions('vehicles.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateVehicleDto) {
        return this.vehiclesService.create(dto, companyId);
    }

    @Get()
    @Permissions('vehicles.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindVehiclesDto) {
        return this.vehiclesService.findAll(dto, companyId);
    }

    @Get(':id')
    @Permissions('vehicles.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.findOne(id, companyId);
    }

    @Patch(':id/driver')
    @Permissions('vehicles.driver.assign')
    setDriver(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVehicleDriverDto) {
        return this.vehiclesService.setDriver(id, dto, companyId);
    }

    @Patch(':id')
    @Permissions('vehicles.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
        return this.vehiclesService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('vehicles.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.vehiclesService.deactivate(id, companyId);
    }
}
