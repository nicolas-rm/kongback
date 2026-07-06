import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { AddOrganizationMemberDto, CreateOrganizationDto, FindOrganizationsDto, UpdateOrganizationDto } from '@/modules/organizations/dto';
import { OrganizationsService } from '@/modules/organizations/services/organizations.service';

@Controller('organizations')
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Post()
    @Permissions('organizations.create')
    create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: RequestUser) {
        return this.organizationsService.create(dto, user.id);
    }

    @Get()
    @Permissions('organizations.read-list')
    findAll(@Query() dto: FindOrganizationsDto) {
        return this.organizationsService.findAll(dto);
    }

    @Get(':id')
    @Permissions('organizations.read-one')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.organizationsService.findOne(id);
    }

    @Patch(':id')
    @Permissions('organizations.update')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: RequestUser) {
        return this.organizationsService.update(id, dto, user.id);
    }

    @Delete(':id')
    @Permissions('organizations.delete')
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
        return this.organizationsService.deactivate(id, user.id);
    }

    @Get(':id/members')
    @Permissions('organizations.members.read')
    listMembers(@Param('id', ParseUUIDPipe) id: string) {
        return this.organizationsService.listMembers(id);
    }

    @Post(':id/members')
    @Permissions('organizations.members.add')
    addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddOrganizationMemberDto) {
        return this.organizationsService.addMember(id, dto);
    }

    @Delete(':id/members/:membershipId')
    @Permissions('organizations.members.remove')
    removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.organizationsService.removeMember(id, membershipId);
    }
}
