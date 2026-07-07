import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { CreateStationDto, FindStationsDto, UpdateStationDto } from '@/modules/business/dto';
import { StationsService } from '@/modules/business/services/stations.service';

@RequireCompany()
@Controller('stations')
export class StationsController {
    constructor(private readonly stationsService: StationsService) {}

    @Post()
    @Permissions('stations.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateStationDto) {
        return this.stationsService.create(dto, companyId);
    }

    @Get()
    @Permissions('stations.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindStationsDto) {
        return this.stationsService.findAll(dto, companyId);
    }

    @Get(':id')
    @Permissions('stations.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.findOne(id, companyId);
    }

    @Patch(':id')
    @Permissions('stations.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationDto) {
        return this.stationsService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('stations.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.deactivate(id, companyId);
    }
}
