import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/decorators';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { CreatePermissionDto, FindAccessControlDto, UpdatePermissionDto } from '@/modules/access-control/dto';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
    constructor(private readonly accessControlService: AccessControlService) {}

    @Post()
    @Permissions('permissions.create')
    create(@Body() dto: CreatePermissionDto) {
        return this.accessControlService.createPermission(dto);
    }

    @Get()
    @Permissions('permissions.read-list')
    findAll(@Query() dto: FindAccessControlDto) {
        return this.accessControlService.findPermissions(dto);
    }

    @Get(':id')
    @Permissions('permissions.read-one')
    findOne(@Param('id') id: string) {
        return this.accessControlService.findPermission(id);
    }

    @Patch(':id')
    @Permissions('permissions.update')
    update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
        return this.accessControlService.updatePermission(id, dto);
    }

    @Delete(':id')
    @Permissions('permissions.delete')
    remove(@Param('id') id: string) {
        return this.accessControlService.deletePermission(id);
    }
}
