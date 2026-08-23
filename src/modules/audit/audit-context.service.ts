import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

export type AuditRequest = Request & {
    user?: RequestUser;
    companyId?: string;
    companyScope?: CompanyScope;
};

export type AuditRequestContext = {
    request: AuditRequest;
    requestId: string;
    startedAt: number;
};

@Injectable()
export class AuditContextService {
    private readonly storage = new AsyncLocalStorage<AuditRequestContext>();

    run<T>(context: AuditRequestContext, callback: () => T): T {
        return this.storage.run(context, callback);
    }

    get current(): AuditRequestContext | undefined {
        return this.storage.getStore();
    }
}
