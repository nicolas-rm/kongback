import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, Permissions, RequireCompany } from '@/decorators';
import { CreateDriverDto, FindDriversDto, UpdateDriverDto } from '@/modules/business/dto';
import { DriversService } from '@/modules/business/services/drivers.service';

@RequireCompany()
@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @Post()
    @Permissions('drivers.create')
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateDriverDto) {
        return this.driversService.create(dto, companyId);
    }

    @Get()
    @Permissions('drivers.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindDriversDto) {
        return this.driversService.findAll(dto, companyId);
    }

    @Get(':id')
    @Permissions('drivers.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.findOne(id, companyId);
    }

    @Patch(':id')
    @Permissions('drivers.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDriverDto) {
        return this.driversService.update(id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('drivers.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.driversService.deactivate(id, companyId);
    }
}
