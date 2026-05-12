import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { AssignRolePermissionsDto, CreateRoleDto, FindAccessControlDto, UpdateRoleDto } from '@/modules/access-control/dto';

@Controller('roles')
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

    @Get(':id')
    @Permissions('roles.read-one')
    findOne(@Param('id') id: string) {
        return this.accessControlService.findRole(id);
    }

    @Patch(':id')
    @Permissions('roles.update')
    update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
        return this.accessControlService.updateRole(id, dto);
    }

    @Delete(':id')
    @Permissions('roles.delete')
    remove(@Param('id') id: string) {
        return this.accessControlService.deleteRole(id);
    }

    @Post(':id/permissions')
    @Permissions('roles.permissions.assign')
    assignPermissions(@Param('id') id: string, @Body() dto: AssignRolePermissionsDto) {
        return this.accessControlService.assignRolePermissions(id, dto);
    }
}
