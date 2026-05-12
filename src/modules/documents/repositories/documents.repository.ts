import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
    constructor(protected readonly prisma: PrismaService) {}
}
