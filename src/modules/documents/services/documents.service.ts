import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { CreateDocumentDto, FindDocumentsDto, UpdateDocumentDto } from '@/modules/documents/dto';
import { DocumentsRepository } from '@/modules/documents/repositories/documents.repository';
import { DocumentsStorageService } from '@/modules/documents/services/documents-storage.service';
import type { UploadedFile } from '@/modules/documents/types/uploaded-file.type';

@Injectable()
export class DocumentsService {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: DocumentsRepository,
        private readonly storage: DocumentsStorageService
    ) {}

    async create(dto: CreateDocumentDto, file: UploadedFile, userId?: string | null) {
        this.assertAllowedFile(file);
        const storedFile = await this.storage.saveFile(file);

        return this.repository.create({
            title: dto.title,
            description: dto.description ?? null,
            category: dto.category ?? null,
            organizationId: dto.organizationId ?? null,
            entityType: dto.entityType ?? null,
            entityId: dto.entityId ?? null,
            scopeKey: dto.scopeKey ?? null,
            scopeId: dto.scopeId ?? null,
            originalName: file.originalname,
            mimeType: file.mimetype,
            uploadedByUserId: userId ?? null,
            createdByUserId: userId ?? null,
            ...storedFile,
        });
    }

    async findAll(dto: FindDocumentsDto) {
        const where: Prisma.DocumentWhereInput = {
            deletedAt: null,
            category: dto.category,
            organizationId: dto.organizationId,
            entityType: dto.entityType,
            entityId: dto.entityId,
            ...(dto.search
                ? {
                      OR: [
                          { title: { contains: dto.search, mode: 'insensitive' } },
                          { originalName: { contains: dto.search, mode: 'insensitive' } },
                          { description: { contains: dto.search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const document = await this.repository.findById(id);
        if (!document) throw new NotFoundException('Documento no encontrado');
        return document;
    }

    update(id: string, dto: UpdateDocumentDto, userId?: string | null) {
        return this.repository.update(id, { ...dto, updatedByUserId: userId ?? null });
    }

    async download(id: string) {
        const document = await this.repository.findDownloadById(id);
        if (!document) throw new NotFoundException('Documento no encontrado');

        await this.storage.assertFileExists(document.storageKey);
        return { document, stream: this.storage.createStream(document.storageKey) };
    }

    async remove(id: string, userId?: string | null) {
        const document = await this.findOne(id);
        await this.repository.softDelete(id, userId);
        await this.storage.removeFile(document.storageKey);
        return { id, deleted: true };
    }

    private assertAllowedFile(file: UploadedFile): void {
        if (!file) throw new BadRequestException('Archivo requerido');
        if (file.size > this.config.documents.maxFileSizeMb * 1024 * 1024) throw new BadRequestException('Archivo demasiado grande');
        if (!this.config.documents.allowedMimeTypes.includes(file.mimetype.toLowerCase())) throw new BadRequestException('Tipo de archivo no permitido');
    }
}
