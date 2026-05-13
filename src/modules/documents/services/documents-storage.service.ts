import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AppConfigService } from '@/configurations/app-config.service';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import type { UploadedFile } from '@/modules/documents/types/uploaded-file.type';

export type StoredDocumentFile = {
    storageKey: string;
    extension: string | null;
    sizeBytes: number;
    checksumSha256: string;
};

@Injectable()
export class DocumentsStorageService {
    constructor(private readonly config: AppConfigService) {}

    async saveFile(file: UploadedFile): Promise<StoredDocumentFile> {
        const extension = this.normalizeExtension(file.originalname);
        const now = new Date();
        const storageKey = path.posix.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), `${randomUUID()}${extension ?? ''}`);
        const absolutePath = this.resolveAbsolutePath(storageKey);

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, file.buffer);

        return {
            storageKey,
            extension,
            sizeBytes: file.size,
            checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
        };
    }

    createStream(storageKey: string) {
        return createReadStream(this.resolveAbsolutePath(storageKey));
    }

    async assertFileExists(storageKey: string): Promise<void> {
        try {
            await fs.access(this.resolveAbsolutePath(storageKey));
        } catch {
            throw new I18nNotFoundException(I18N_KEYS.errors.documents.storageFileNotFound, 'Archivo no encontrado en almacenamiento');
        }
    }

    async removeFile(storageKey: string): Promise<void> {
        await fs.rm(this.resolveAbsolutePath(storageKey), { force: true });
    }

    private resolveAbsolutePath(storageKey: string): string {
        const normalized = path.posix.normalize(storageKey.replace(/\\/g, '/'));
        if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) throw new I18nBadRequestException(I18N_KEYS.errors.documents.invalidFilePath, 'Ruta de archivo invalida');

        const baseDirectory = this.getBaseDirectory();
        const absolutePath = path.resolve(baseDirectory, normalized);
        if (absolutePath !== baseDirectory && !absolutePath.startsWith(`${baseDirectory}${path.sep}`)) throw new I18nBadRequestException(I18N_KEYS.errors.documents.invalidFilePath, 'Ruta de archivo invalida');

        return absolutePath;
    }

    private getBaseDirectory(): string {
        return path.isAbsolute(this.config.documents.storageDir) ? this.config.documents.storageDir : path.resolve(process.cwd(), this.config.documents.storageDir);
    }

    private normalizeExtension(filename: string): string | null {
        const extension = path.extname(filename).toLowerCase();
        if (!extension) return null;

        const sanitized = extension.replace(/[^a-z0-9.]/g, '');
        return sanitized.startsWith('.') && sanitized.length <= 15 ? sanitized : null;
    }
}
