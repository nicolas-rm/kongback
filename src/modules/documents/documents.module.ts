import { Module } from '@nestjs/common';
import { DocumentsRepository } from '@/modules/documents/repositories/documents.repository';
import { DocumentsService } from '@/modules/documents/services/documents.service';

@Module({
    providers: [DocumentsRepository, DocumentsService],
    exports: [DocumentsService],
})
export class DocumentsModule {}
