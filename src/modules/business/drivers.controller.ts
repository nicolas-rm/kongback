import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateDriverDto, FindDriversDto, UpdateDriverDto } from '@/modules/business/dto';
import { DriversService } from '@/modules/business/services/drivers.service';

@RequireOrganization()
@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @Post()
    @Permissions('drivers.create')
    create(@CurrentOrganizationId() organizationId: string, @Body() dto: CreateDriverDto) {
        return this.driversService.create(organizationId, dto);
    }

    @Get()
    @Permissions('drivers.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @Query() dto: FindDriversDto) {
        return this.driversService.findAll(organizationId, dto);
    }

    @Get(':id')
    @Permissions('drivers.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.findOne(organizationId, id);
    }

    @Patch(':id')
    @Permissions('drivers.update')
    update(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
        return this.driversService.update(organizationId, id, dto);
    }

    @Delete(':id')
    @Permissions('drivers.delete')
    remove(@CurrentOrganizationId() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.deactivate(organizationId, id);
    }
}
