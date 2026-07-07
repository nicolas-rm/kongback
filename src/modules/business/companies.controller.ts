import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, CurrentUser, Permissions, RequireOrganization } from '@/decorators';
import { I18N_KEYS, I18nForbiddenException } from '@/i18n';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateCompanyDto, FindStatusRecordsDto, UpdateCompanyDto } from '@/modules/business/dto';
import { CompaniesService } from '@/modules/business/services/companies.service';

@RequireOrganization()
@Controller('companies')
export class CompaniesController {
    constructor(
        private readonly companiesService: CompaniesService,
        private readonly accessControl: AccessControlService
    ) {}

    @Post()
    @Permissions('companies.create')
    async create(@CurrentOrganizationId() organizationId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateCompanyDto) {
        await this.assertCanCreateCompany(user, organizationId);
        return this.companiesService.create(organizationId, dto);
    }

    @Get()
    @Permissions('companies.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindStatusRecordsDto) {
        return this.companiesService.findAll(organizationId, dto, companyId);
    }

    @Get(':id')
    @Permissions('companies.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.findOne(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('companies.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
        return this.companiesService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('companies.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.companiesService.deactivate(organizationId, id, companyId);
    }

    private async assertCanCreateCompany(user: RequestUser, organizationId: string): Promise<void> {
        if (user.isGlobalAdmin) return;
        if (await this.accessControl.userHasOrganizationWideAccess(user.id, organizationId)) return;

        throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
    }
}
