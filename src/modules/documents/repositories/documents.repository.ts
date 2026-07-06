import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { activeRecordWhere, softDeleteData } from '@/utilities/prisma/soft-delete';

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

    countActiveOrganizations(ids: string[]): Promise<number> {
        return this.prisma.organization.count({ where: { id: { in: ids }, status: 'active' } });
    }

    findById(id: string, organizationId: string, companyId?: string) {
        return this.prisma.document.findFirst({ where: activeRecordWhere(this.scopeWhere(id, organizationId, companyId)), select: this.publicSelect() });
    }

    findDownloadById(id: string, organizationId: string, companyId?: string) {
        return this.prisma.document.findFirst({
            where: activeRecordWhere(this.scopeWhere(id, organizationId, companyId)),
            select: {
                id: true,
                originalName: true,
                mimeType: true,
                storageKey: true,
            },
        });
    }

    update(id: string, organizationId: string, data: Prisma.DocumentUncheckedUpdateManyInput, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.document.updateMany({ where: activeRecordWhere(this.scopeWhere(id, organizationId, companyId)), data });
            if (result.count === 0) return null;

            return tx.document.findFirst({ where: activeRecordWhere(this.scopeWhere(id, organizationId, companyId)), select: this.publicSelect() });
        });
    }

    softDelete(id: string, organizationId: string, userId?: string | null, companyId?: string) {
        return this.prisma.document.updateMany({
            where: activeRecordWhere(this.scopeWhere(id, organizationId, companyId)),
            data: softDeleteData(userId ?? null),
        });
    }

    private scopeWhere(id: string, organizationId: string, companyId?: string): Prisma.DocumentWhereInput {
        return {
            id,
            organizationId,
            ...(companyId
                ? {
                      OR: [
                          { scopeKey: 'companyId', scopeId: companyId },
                          { entityType: 'company', entityId: companyId },
                      ],
                  }
                : {}),
        };
    }

    private publicSelect(): Prisma.DocumentSelect {
        return {
            id: true,
            title: true,
            description: true,
            category: true,
            organizationId: true,
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
