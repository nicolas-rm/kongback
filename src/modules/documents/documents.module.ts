import { Module } from '@nestjs/common';
import { DocumentsController } from '@/modules/documents/documents.controller';
import { DocumentsRepository } from '@/modules/documents/repositories/documents.repository';
import { DocumentsStorageService } from '@/modules/documents/services/documents-storage.service';
import { DocumentsService } from '@/modules/documents/services/documents.service';

@Module({
    controllers: [DocumentsController],
    providers: [DocumentsRepository, DocumentsStorageService, DocumentsService],
    exports: [DocumentsStorageService, DocumentsService],
})
export class DocumentsModule {}
