import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive } from '@/modules/business/business.helpers';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CreateDocumentDto, FindDocumentsDto, UpdateDocumentDto } from '@/modules/documents/dto';
import { DocumentsRepository } from '@/modules/documents/repositories/documents.repository';
import { DocumentResponse } from '@/modules/documents/responses';
import { DocumentsStorageService } from '@/modules/documents/services/documents-storage.service';
import type { UploadedFile } from '@/modules/documents/types/uploaded-file.type';

@Injectable()
export class DocumentsService {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: DocumentsRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly storage: DocumentsStorageService
    ) {}

    async create(dto: CreateDocumentDto, file: UploadedFile, userId?: string | null, scope?: CompanyScope) {
        this.assertAllowedFile(file);
        const documentScope = await this.resolveDocumentScope(dto.scopeKey, dto.scopeId, scope);

        const storedFile = await this.storage.saveFile(file);

        const document = await this.repository.create({
            title: dto.title,
            description: dto.description ?? null,
            category: dto.category ?? null,
            companyId: scope?.companyId ?? null,
            entityType: dto.entityType ?? null,
            entityId: dto.entityId ?? null,
            scopeKey: documentScope.scopeKey,
            scopeId: documentScope.scopeId,
            originalName: file.originalname,
            mimeType: file.mimetype,
            uploadedByUserId: userId ?? null,
            createdByUserId: userId ?? null,
            ...storedFile,
        });
        return DocumentResponse.from(document);
    }

    async findAll(dto: FindDocumentsDto, scope?: CompanyScope) {
        const and: Prisma.DocumentWhereInput[] = [];
        if (dto.search) {
            and.push({
                OR: [
                    { title: { contains: dto.search, mode: 'insensitive' } },
                    { originalName: { contains: dto.search, mode: 'insensitive' } },
                    { description: { contains: dto.search, mode: 'insensitive' } },
                ],
            });
        }

        const where: Prisma.DocumentWhereInput = {
            deletedAt: null,
            category: dto.category,
            companyId: scope?.companyId,
            ...(scope?.subCompanyIds ? { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds } } : {}),
            entityType: dto.entityType,
            entityId: dto.entityId,
            ...(and.length ? { AND: and } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(
            data.map((document) => DocumentResponse.from(document)),
            total,
            dto
        );
    }

    async findOne(id: string, scope?: CompanyScope) {
        const document = await this.repository.findById(id, scope);
        if (!document) throw new I18nNotFoundException(I18N_KEYS.errors.documents.notFound, 'Documento no encontrado');
        return DocumentResponse.from(document);
    }

    async update(id: string, dto: UpdateDocumentDto, userId?: string | null, scope?: CompanyScope) {
        const document = await this.repository.update(id, { ...dto, updatedByUserId: userId ?? null }, scope);
        if (!document) throw new I18nNotFoundException(I18N_KEYS.errors.documents.notFound, 'Documento no encontrado');

        return DocumentResponse.from(document);
    }

    async download(id: string, scope?: CompanyScope) {
        const document = await this.repository.findDownloadById(id, scope);
        if (!document) throw new I18nNotFoundException(I18N_KEYS.errors.documents.notFound, 'Documento no encontrado');

        await this.storage.assertFileExists(document.storageKey);
        return { document, stream: this.storage.createStream(document.storageKey) };
    }

    async remove(id: string, userId?: string | null, scope?: CompanyScope) {
        const document = await this.repository.findDownloadById(id, scope);
        if (!document) throw new I18nNotFoundException(I18N_KEYS.errors.documents.notFound, 'Documento no encontrado');

        const result = await this.repository.softDelete(id, userId, scope);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.documents.notFound, 'Documento no encontrado');

        await this.storage.removeFile(document.storageKey);
        return { id, deleted: true };
    }

    private assertAllowedFile(file: UploadedFile): void {
        if (!file) throw new I18nBadRequestException(I18N_KEYS.errors.documents.fileRequired, 'Archivo requerido');
        if (file.size > this.config.documents.maxFileSizeMb * 1024 * 1024) throw new I18nBadRequestException(I18N_KEYS.errors.documents.fileTooLarge, 'Archivo demasiado grande');
        const mimeType = file.mimetype.toLowerCase();
        if (!this.config.documents.allowedMimeTypes.includes(mimeType)) throw new I18nBadRequestException(I18N_KEYS.errors.documents.mimeTypeNotAllowed, 'Tipo de archivo no permitido');
        if (!this.matchesDeclaredMimeType(file.buffer, mimeType)) throw new I18nBadRequestException(I18N_KEYS.errors.documents.mimeTypeNotAllowed, 'Tipo de archivo no permitido');
    }

    private matchesDeclaredMimeType(buffer: Buffer, mimeType: string): boolean {
        if (mimeType === 'application/pdf') return buffer.subarray(0, 5).equals(Buffer.from('%PDF-'));
        if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        if (mimeType === 'text/plain') return this.isUtf8Text(buffer);

        return false;
    }

    private isUtf8Text(buffer: Buffer): boolean {
        if (buffer.includes(0)) return false;
        return Buffer.from(buffer.toString('utf8'), 'utf8').equals(buffer);
    }

    private async resolveDocumentScope(scopeKey?: string | null, scopeId?: string | null, scope?: CompanyScope): Promise<{ scopeKey: string; scopeId: string }> {
        if (!scope?.companyId) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
        }

        if (scope.subCompanyIds) {
            if (scopeKey && scopeKey !== SUB_COMPANY_SCOPE_KEY) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
            const subCompanyId = scopeId ?? (scope.subCompanyIds.length === 1 ? scope.subCompanyIds[0] : null);
            if (!subCompanyId || !scope.subCompanyIds.includes(subCompanyId)) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
            return { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: subCompanyId };
        }

        if (scopeKey === SUB_COMPANY_SCOPE_KEY) {
            if (!scopeId) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
            await assertActive([{ ids: [scopeId], count: (ids) => this.relations.countActiveSubCompanies(ids, scope) }]);
            return { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId };
        }

        if ((scopeKey && scopeKey !== 'companyId') || (scopeId && scopeId !== scope.companyId)) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');

        return { scopeKey: 'companyId', scopeId: scope.companyId };
    }
}
