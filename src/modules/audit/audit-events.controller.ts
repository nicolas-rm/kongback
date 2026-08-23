import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireSystemOrCompanyAccess } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { AuditEventsService } from '@/modules/audit/audit-events.service';
import { FindAuditEventsDto } from '@/modules/audit/dto/find-audit-events.dto';

@Controller('audit')
@RequireSystemOrCompanyAccess()
export class AuditEventsController {
    constructor(private readonly auditEventsService: AuditEventsService) {}

    @Get('requests')
    @Permissions('audit.read-list')
    findRequests(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findBySource('request', dto, scope);
    }

    @Get('requests/:id')
    @Permissions('audit.read-one')
    findRequest(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('request', id, scope);
    }

    @Get('security')
    @Permissions('audit.read-list')
    findSecurity(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findBySource('security', dto, scope);
    }

    @Get('security/:id')
    @Permissions('audit.read-one')
    findSecurityEvent(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('security', id, scope);
    }

    @Get('access')
    @Permissions('audit.read-list')
    findAccess(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findBySource('access', dto, scope);
    }

    @Get('access/:id')
    @Permissions('audit.read-one')
    findAccessEvent(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('access', id, scope);
    }

    @Get('business')
    @Permissions('audit.read-list')
    findBusiness(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findBySource('business', dto, scope);
    }

    @Get('business/:id')
    @Permissions('audit.read-one')
    findBusinessEvent(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('business', id, scope);
    }

    @Get('cards')
    @Permissions('audit.read-list')
    findCards(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findBySource('card', dto, scope);
    }

    @Get('cards/:id')
    @Permissions('audit.read-one')
    findCardEvent(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('card', id, scope);
    }

    @Get('cardcloud')
    @Permissions('audit.read-list')
    findCardcloud(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findBySource('cardcloud', dto, scope);
    }

    @Get('cardcloud/:id')
    @Permissions('audit.read-one')
    findCardcloudEvent(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('cardcloud', id, scope);
    }

    @Get('transfers')
    @Permissions('audit.read-list')
    findTransfers(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findTransfers(dto, scope);
    }

    @Get('transfers/:id')
    @Permissions('audit.read-one')
    findTransfer(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('cardcloud', id, scope);
    }

    @Get('card-assignments')
    @Permissions('audit.read-list')
    findCardAssignments(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindAuditEventsDto) {
        return this.auditEventsService.findCardAssignments(dto, scope);
    }

    @Get('card-assignments/cards/:id')
    @Permissions('audit.read-one')
    findCardAssignment(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('card', id, scope);
    }

    @Get('card-assignments/cardcloud/:id')
    @Permissions('audit.read-one')
    findCardcloudAssignment(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.auditEventsService.findOne('cardcloud', id, scope);
    }
}
