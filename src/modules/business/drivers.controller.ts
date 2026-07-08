import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateDriverDto, FindDriversDto, UpdateDriverDto } from '@/modules/business/dto';
import { DriversService } from '@/modules/business/services/drivers.service';

@RequireCompany()
@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @Post()
    @Permissions('drivers.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateDriverDto) {
        return this.driversService.create(dto, scope);
    }

    @Get()
    @Permissions('drivers.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindDriversDto) {
        return this.driversService.findAll(dto, scope);
    }

    @Get(':id')
    @Permissions('drivers.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('drivers.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
        return this.driversService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('drivers.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.deactivate(id, scope);
    }
}
