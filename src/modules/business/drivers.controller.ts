import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { CreateDriverDto, FindDriversDto, UpdateDriverDto } from '@/modules/business/dto';
import { DriversService } from '@/modules/business/services/drivers.service';

@RequireOrganization()
@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @Post()
    @Permissions('drivers.create')
    create(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateDriverDto) {
        return this.driversService.create(organizationId, dto, companyId);
    }

    @Get()
    @Permissions('drivers.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindDriversDto) {
        return this.driversService.findAll(organizationId, dto, companyId);
    }

    @Get(':id')
    @Permissions('drivers.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.findOne(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('drivers.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
        return this.driversService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('drivers.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.deactivate(organizationId, id, companyId);
    }
}
