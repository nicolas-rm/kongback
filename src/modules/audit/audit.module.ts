import { Global, Module } from '@nestjs/common';
import { AuditEventsController } from '@/modules/audit/audit-events.controller';
import { AuditEventsRepository } from '@/modules/audit/repositories/audit-events.repository';
import { AuditEventsService } from '@/modules/audit/audit-events.service';
import { AuditContextService } from '@/modules/audit/audit-context.service';
import { AuditService } from '@/modules/audit/audit.service';

@Global()
@Module({
    controllers: [AuditEventsController],
    providers: [AuditContextService, AuditService, AuditEventsRepository, AuditEventsService],
    exports: [AuditContextService, AuditService],
})
export class AuditModule {}
