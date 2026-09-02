import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { Permissions, RequireSystemAccess } from '@/decorators';
import { setExcelAttachmentHeaders } from '@/utilities/export/excel-export';
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

    @Get('export')
    @Permissions('roles.read-list')
    async exportList(@Query() dto: FindAccessControlDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.accessControlService.exportRoles(dto);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
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
