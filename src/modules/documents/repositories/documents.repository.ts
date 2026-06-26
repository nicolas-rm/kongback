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

    findById(id: string) {
        return this.prisma.document.findFirst({ where: activeRecordWhere({ id }), select: this.publicSelect() });
    }

    findDownloadById(id: string) {
        return this.prisma.document.findFirst({
            where: activeRecordWhere({ id }),
            select: {
                id: true,
                originalName: true,
                mimeType: true,
                storageKey: true,
            },
        });
    }

    update(id: string, data: Prisma.DocumentUncheckedUpdateInput) {
        return this.prisma.document.update({ where: { id }, data, select: this.publicSelect() });
    }

    softDelete(id: string, userId?: string | null) {
        return this.prisma.document.update({
            where: { id },
            data: softDeleteData(userId ?? null),
            select: { id: true },
        });
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
