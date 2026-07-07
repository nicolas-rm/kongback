import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { StationFuelsService } from '@/modules/business/services/station-fuels.service';

@RequireCompany()
@Controller('station-fuels')
export class StationFuelsController {
    constructor(private readonly stationFuelsService: StationFuelsService) {}

    @Post()
    @Permissions('station-fuels.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateStationFuelDto) {
        return this.stationFuelsService.create(dto, companyId);
    }

    @Get()
    @Permissions('station-fuels.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindStationFuelsDto) {
        return this.stationFuelsService.findAll(dto, companyId);
    }

    @Get(':id')
    @Permissions('station-fuels.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.findOne(id, companyId);
    }

    @Patch(':id')
    @Permissions('station-fuels.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationFuelDto) {
        return this.stationFuelsService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('station-fuels.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationFuelsService.deactivate(id, companyId);
    }
}
