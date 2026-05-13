import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/decorators';
import { AssignUserAccessDto, ChangeUserPasswordDto, CreateUserDto, FindUsersDto, ReplaceUserAccessDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersService } from '@/modules/users/services/users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @Permissions('users.create')
    create(@Body() dto: CreateUserDto) {
        return this.usersService.create(dto);
    }

    @Get()
    @Permissions('users.read-list')
    findAll(@Query() dto: FindUsersDto) {
        return this.usersService.findAll(dto);
    }

    @Patch(':id')
    @Permissions('users.update')
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(id, dto);
    }

    @Delete(':id')
    @Permissions('users.delete')
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }

    @Get(':id/access')
    @Permissions('users.access.read')
    listAccess(@Param('id') id: string) {
        return this.usersService.listAccess(id);
    }

    @Get(':id/permissions')
    @Permissions('users.permissions.read')
    listPermissions(@Param('id') id: string) {
        return this.usersService.listPermissions(id);
    }

    @Post(':id/access')
    @Permissions('users.access.assign')
    assignAccess(@Param('id') id: string, @Body() dto: AssignUserAccessDto) {
        return this.usersService.assignAccess(id, dto);
    }

    @Put(':id/access')
    @Permissions('users.access.assign')
    replaceAccess(@Param('id') id: string, @Body() dto: ReplaceUserAccessDto) {
        return this.usersService.replaceAccess(id, dto);
    }

    @Delete(':id/access/:accessId')
    @Permissions('users.access.assign')
    removeAccess(@Param('id') id: string, @Param('accessId') accessId: string) {
        return this.usersService.removeAccess(id, accessId);
    }

    @Patch(':id/password')
    @Permissions('users.password.update')
    changePassword(@Param('id') id: string, @Body() dto: ChangeUserPasswordDto) {
        return this.usersService.changePassword(id, dto);
    }

    @Patch(':id/2fa/unlink')
    @Permissions('users.2fa.unlink')
    unlinkTwoFactor(@Param('id') id: string) {
        return this.usersService.unlinkTwoFactor(id);
    }

    @Post(':id/resend-credentials')
    @Permissions('users.credentials.resend')
    resendCredentials(@Param('id') id: string) {
        return this.usersService.resendCredentials(id);
    }

    @Get(':id')
    @Permissions('users.read-one')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }
}
