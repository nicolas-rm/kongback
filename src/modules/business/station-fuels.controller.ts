import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { StationFuelsService } from '@/modules/business/services/station-fuels.service';

@RequireCompany()
@Controller('station-fuels')
export class StationFuelsController {
    constructor(private readonly stationFuelsService: StationFuelsService) {}

    @Post()
    @Permissions('station-fuels.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateStationFuelDto) {
        return this.stationFuelsService.create(dto, scope);
    }

    @Get()
    @Permissions('station-fuels.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindStationFuelsDto) {
        return this.stationFuelsService.findAll(dto, scope);
    }

    @Get(':id')
    @Permissions('station-fuels.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('station-fuels.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationFuelDto) {
        return this.stationFuelsService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('station-fuels.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.deactivate(id, scope);
    }
}
