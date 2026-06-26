import { Module } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfigModule } from '@/configurations/app-config.module';
import { AppConfigService } from '@/configurations/app-config.service';
import { DocumentsController } from '@/modules/documents/documents.controller';
import { DocumentsRepository } from '@/modules/documents/repositories/documents.repository';
import { DocumentsStorageService } from '@/modules/documents/services/documents-storage.service';
import { DocumentsService } from '@/modules/documents/services/documents.service';

@Module({
    imports: [
        MulterModule.registerAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => ({
                limits: { fileSize: config.documents.maxFileSizeMb * 1024 * 1024 },
                fileFilter: (_request, file, callback) => {
                    const allowed = config.documents.allowedMimeTypes.includes(file.mimetype.toLowerCase());
                    callback(allowed ? null : new BadRequestException('Tipo de archivo no permitido'), allowed);
                },
            }),
        }),
    ],
    controllers: [DocumentsController],
    providers: [DocumentsRepository, DocumentsStorageService, DocumentsService],
    exports: [DocumentsStorageService, DocumentsService],
})
export class DocumentsModule {}
