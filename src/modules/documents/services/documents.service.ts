import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from '@/modules/documents/repositories/documents.repository';

@Injectable()
export class DocumentsService {
    constructor(private readonly documentsRepository: DocumentsRepository) {}
}
