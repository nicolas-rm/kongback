import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentCompanyScope, CurrentUser, Permissions, RequireSystemAccess, RequireSystemOrCompanyAccess } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { setExcelAttachmentHeaders } from '@/utilities/export/excel-export';
import { AssignUserAccessDto, ChangeUserPasswordDto, CreateUserDto, FindUsersDto, ReplaceUserAccessDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersService } from '@/modules/users/services/users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @Permissions('users.create')
    @RequireSystemOrCompanyAccess()
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateUserDto) {
        return this.usersService.create(dto, scope);
    }

    @Get()
    @Permissions('users.read-list')
    @RequireSystemOrCompanyAccess()
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindUsersDto) {
        return this.usersService.findAll(dto, scope);
    }

    @Get('export')
    @Permissions('users.read-list')
    @RequireSystemOrCompanyAccess()
    async exportList(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindUsersDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.usersService.exportList(dto, scope);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Patch(':id')
    @Permissions('users.update')
    @RequireSystemAccess()
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('users.delete')
    @RequireSystemAccess()
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.remove(id);
    }

    @Get(':id/access')
    @Permissions('users.access.read')
    @RequireSystemOrCompanyAccess()
    listAccess(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.listAccess(id, scope);
    }

    @Get(':id/permissions')
    @Permissions('users.permissions.read')
    @RequireSystemOrCompanyAccess()
    listPermissions(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.listPermissions(id, scope);
    }

    @Post(':id/access')
    @Permissions('users.access.assign')
    @RequireSystemOrCompanyAccess()
    assignAccess(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignUserAccessDto) {
        return this.usersService.assignAccess(id, dto, scope);
    }

    @Put(':id/access')
    @Permissions('users.access.assign')
    @RequireSystemOrCompanyAccess()
    replaceAccess(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceUserAccessDto) {
        return this.usersService.replaceAccess(id, dto, scope);
    }

    @Delete(':id/access/:accessId')
    @Permissions('users.access.assign')
    @RequireSystemOrCompanyAccess()
    removeAccess(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Param('accessId', ParseUUIDPipe) accessId: string) {
        return this.usersService.removeAccess(id, accessId, scope);
    }

    @Patch(':id/password')
    @Permissions('users.password.update')
    @RequireSystemAccess()
    changePassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeUserPasswordDto) {
        return this.usersService.changePassword(id, dto);
    }

    @Patch(':id/2fa/unlink')
    @Permissions('users.2fa.unlink')
    @RequireSystemAccess()
    unlinkTwoFactor(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.unlinkTwoFactor(id);
    }

    @Post(':id/resend-credentials')
    @Permissions('users.credentials.resend')
    @RequireSystemAccess()
    resendCredentials(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.resendCredentials(id, user.id);
    }

    @Get(':id')
    @Permissions('users.read-one')
    @RequireSystemOrCompanyAccess()
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.findOne(id, scope);
    }
}
