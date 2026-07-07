import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Permissions, RequireSystemAccess } from '@/decorators';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { AssignRolePermissionsDto, CreateRoleDto, FindAccessControlDto, UpdateRoleDto } from '@/modules/access-control/dto';

@Controller('roles')
@RequireSystemAccess()
export class RolesController {
    constructor(private readonly accessControlService: AccessControlService) {}

    @Post()
    @Permissions('roles.create')
    create(@Body() dto: CreateRoleDto) {
        return this.accessControlService.createRole(dto);
    }

    @Get()
    @Permissions('roles.read-list')
    findAll(@Query() dto: FindAccessControlDto) {
        return this.accessControlService.findRoles(dto);
    }

    @Patch(':id')
    @Permissions('roles.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
        return this.accessControlService.updateRole(id, dto);
    }

    @Delete(':id')
    @Permissions('roles.delete')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.accessControlService.deleteRole(id);
    }

    @Put(':id/permissions')
    @Permissions('roles.permissions.assign')
    replacePermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolePermissionsDto) {
        return this.accessControlService.assignRolePermissions(id, dto);
    }

    @Get(':id/permissions')
    @Permissions('roles.permissions.read')
    listPermissions(@Param('id', ParseUUIDPipe) id: string) {
        return this.accessControlService.findRolePermissions(id);
    }

    @Get(':id')
    @Permissions('roles.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.accessControlService.findRole(id);
    }
}
