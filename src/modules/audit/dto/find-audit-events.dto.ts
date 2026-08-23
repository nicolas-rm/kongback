import { ValidatorDate, ValidatorEnum, ValidatorString, ValidatorUUID } from '@/decorators';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';

export const AUDIT_EVENT_SOURCES = ['request', 'security', 'access', 'business', 'card', 'cardcloud'] as const;
export type AuditEventSource = (typeof AUDIT_EVENT_SOURCES)[number];
export const AUDIT_EVENT_RESULTS = ['success', 'failure', 'denied'] as const;
export type AuditEventResult = (typeof AUDIT_EVENT_RESULTS)[number];

export class FindAuditEventsDto extends PaginationDto {
    @ValidatorEnum(AUDIT_EVENT_SOURCES, { optional: true, toLowerCase: true })
    source?: AuditEventSource;

    @ValidatorEnum(AUDIT_EVENT_RESULTS, { optional: true, toLowerCase: true })
    result?: AuditEventResult;

    @ValidatorString({ optional: true })
    action?: string;

    @ValidatorString({ optional: true })
    method?: string;

    @ValidatorString({ optional: true })
    path?: string;

    @ValidatorUUID({ optional: true })
    actorUserId?: string;

    @ValidatorUUID({ optional: true })
    companyId?: string;

    @ValidatorString({ optional: true })
    requestId?: string;

    @ValidatorString({ optional: true })
    resourceType?: string;

    @ValidatorString({ optional: true })
    resourceId?: string;

    @ValidatorDate({ optional: true })
    from?: string;

    @ValidatorDate({ optional: true })
    to?: string;
}
