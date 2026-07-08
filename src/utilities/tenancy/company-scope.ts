import { Prisma } from '@prisma/client';

export const SUB_COMPANY_SCOPE_KEY = 'subCompanyId';

export type CompanyScope = {
    companyId?: string;
    subCompanyIds?: string[];
};

export function companyScopeWhere(scope?: CompanyScope): Prisma.CompanyWhereInput {
    return {
        ...(scope?.companyId ? { id: scope.companyId } : {}),
    };
}

export function subCompanyScopeWhere(scope?: CompanyScope): Prisma.SubCompanyWhereInput {
    return {
        ...(scope?.subCompanyIds ? { id: { in: scope.subCompanyIds } } : {}),
        company: companyScopeWhere(scope),
    };
}

export function scopedSubCompanyIdFilter(subCompanyId?: string, scope?: CompanyScope): string | Prisma.StringFilter | undefined {
    if (!scope?.subCompanyIds) return subCompanyId;
    if (subCompanyId) return scope.subCompanyIds.includes(subCompanyId) ? subCompanyId : { in: [] };
    return { in: scope.subCompanyIds };
}

export function hasCompanyWideScope(scope?: CompanyScope): boolean {
    return !scope?.subCompanyIds;
}
