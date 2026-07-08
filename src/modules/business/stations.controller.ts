import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateStationDto, FindStationsDto, UpdateStationDto } from '@/modules/business/dto';
import { StationsService } from '@/modules/business/services/stations.service';

@RequireCompany()
@Controller('stations')
export class StationsController {
    constructor(private readonly stationsService: StationsService) {}

    @Post()
    @Permissions('stations.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateStationDto) {
        return this.stationsService.create(dto, scope);
    }

    @Get()
    @Permissions('stations.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindStationsDto) {
        return this.stationsService.findAll(dto, scope);
    }

    @Get(':id')
    @Permissions('stations.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('stations.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStationDto) {
        return this.stationsService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('stations.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.stationsService.deactivate(id, scope);
    }
}
