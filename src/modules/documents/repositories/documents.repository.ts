import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { activeRecordWhere, softDeleteData } from '@/utilities/prisma/soft-delete';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';

@Injectable()
export class DocumentsRepository {
    constructor(protected readonly prisma: PrismaService) {}

    create(data: Prisma.DocumentUncheckedCreateInput) {
        return this.prisma.document.create({ data, select: this.publicSelect() });
    }

    findMany(where: Prisma.DocumentWhereInput, skip: number, take?: number) {
        return this.prisma.document.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: this.publicSelect() });
    }

    count(where: Prisma.DocumentWhereInput): Promise<number> {
        return this.prisma.document.count({ where });
    }

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.document.findFirst({ where: activeRecordWhere(this.scopeWhere(id, scope)), select: this.publicSelect() });
    }

    findDownloadById(id: string, scope?: CompanyScope) {
        return this.prisma.document.findFirst({
            where: activeRecordWhere(this.scopeWhere(id, scope)),
            select: {
                id: true,
                originalName: true,
                mimeType: true,
                storageKey: true,
            },
        });
    }

    update(id: string, data: Prisma.DocumentUncheckedUpdateManyInput, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.document.updateMany({ where: activeRecordWhere(this.scopeWhere(id, scope)), data });
            if (result.count === 0) return null;

            return tx.document.findFirst({ where: activeRecordWhere(this.scopeWhere(id, scope)), select: this.publicSelect() });
        });
    }

    softDelete(id: string, userId?: string | null, scope?: CompanyScope) {
        return this.prisma.document.updateMany({
            where: activeRecordWhere(this.scopeWhere(id, scope)),
            data: softDeleteData(userId ?? null),
        });
    }

    private scopeWhere(id: string, scope?: CompanyScope): Prisma.DocumentWhereInput {
        return {
            id,
            ...(scope?.companyId ? { companyId: scope.companyId } : {}),
            ...(scope?.subCompanyIds ? { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds } } : {}),
        };
    }

    private publicSelect(): Prisma.DocumentSelect {
        return {
            id: true,
            title: true,
            description: true,
            category: true,
            companyId: true,
            entityType: true,
            entityId: true,
            scopeKey: true,
            scopeId: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
        };
    }
}
