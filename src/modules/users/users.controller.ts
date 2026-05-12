import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '@/decorators';
import { AssignUserAccessDto, CreateUserDto, FindUsersDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersService } from '@/modules/users/services/users.service';

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

    @Get(':id')
    @Permissions('users.read-one')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
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

    @Post(':id/access')
    @Permissions('users.access.assign')
    assignAccess(@Param('id') id: string, @Body() dto: AssignUserAccessDto) {
        return this.usersService.assignAccess(id, dto);
    }

    @Delete(':id/access/:accessId')
    @Permissions('users.access.assign')
    removeAccess(@Param('id') id: string, @Param('accessId') accessId: string) {
        return this.usersService.removeAccess(id, accessId);
    }
}
