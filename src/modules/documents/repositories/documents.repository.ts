import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
    constructor(protected readonly prisma: PrismaService) {}

    create(data: Prisma.DocumentUncheckedCreateInput) {
        return this.prisma.document.create({ data });
    }

    findMany(where: Prisma.DocumentWhereInput, skip: number, take?: number) {
        return this.prisma.document.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } });
    }

    count(where: Prisma.DocumentWhereInput): Promise<number> {
        return this.prisma.document.count({ where });
    }

    findById(id: string) {
        return this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    }

    update(id: string, data: Prisma.DocumentUncheckedUpdateInput) {
        return this.prisma.document.update({ where: { id }, data });
    }

    softDelete(id: string, userId?: string | null) {
        return this.prisma.document.update({
            where: { id },
            data: { deletedAt: new Date(), deletedByUserId: userId ?? null },
        });
    }
}
