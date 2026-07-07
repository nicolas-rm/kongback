import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permissions, RequireSystemAccess } from '@/decorators';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { CreatePermissionDto, FindAccessControlDto, UpdatePermissionDto } from '@/modules/access-control/dto';

@Controller('permissions')
@RequireSystemAccess()
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
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.accessControlService.findPermission(id);
    }

    @Patch(':id')
    @Permissions('permissions.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionDto) {
        return this.accessControlService.updatePermission(id, dto);
    }

    @Delete(':id')
    @Permissions('permissions.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.accessControlService.deletePermission(id);
    }
}
