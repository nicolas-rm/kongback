import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

export const COMPANY_CONTEXT_REQUIRED_KEY = 'companyContextRequired';

export type CompanyRequest = Request & { companyId?: string; companyScope?: CompanyScope };

export const RequireCompany = () => SetMetadata(COMPANY_CONTEXT_REQUIRED_KEY, true);

export const CurrentCompanyId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<CompanyRequest>();
    return request.companyId;
});

export const CurrentCompanyScope = createParamDecorator((_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<CompanyRequest>();
    return request.companyScope;
});
