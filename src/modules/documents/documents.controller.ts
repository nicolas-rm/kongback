import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentCompanyId, CurrentUser, Permissions, RequireCompany } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateDocumentDto, FindDocumentsDto, UpdateDocumentDto } from '@/modules/documents/dto';
import { DocumentsService } from '@/modules/documents/services/documents.service';
import type { UploadedFile as AppUploadedFile } from '@/modules/documents/types/uploaded-file.type';

@RequireCompany()
@Controller('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Post()
    @Permissions('documents.create')
    @UseInterceptors(FileInterceptor('file'))
    create(@CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateDocumentDto, @UploadedFile() file: AppUploadedFile, @CurrentUser() user: RequestUser) {
        return this.documentsService.create(dto, file, user.id, companyId);
    }

    @Get()
    @Permissions('documents.read-list')
    findAll(@CurrentCompanyId() companyId: string | undefined, @Query() dto: FindDocumentsDto) {
        return this.documentsService.findAll(dto, companyId);
    }

    @Get(':id/download')
    @Permissions('documents.download')
    @Header('Content-Type', 'application/octet-stream')
    async download(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
        const { document, stream } = await this.documentsService.download(id, companyId);
        response.setHeader('Content-Type', document.mimeType);
        response.setHeader('Content-Disposition', this.buildAttachmentDisposition(document.originalName));
        stream.pipe(response);
    }

    @Get(':id')
    @Permissions('documents.read-one')
    findOne(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.documentsService.findOne(id, companyId);
    }

    @Patch(':id')
    @Permissions('documents.update')
    update(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: RequestUser) {
        return this.documentsService.update(id, dto, user.id, companyId);
    }

    @Delete(':id')
    @Permissions('documents.delete')
    remove(@CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
        return this.documentsService.remove(id, user.id, companyId);
    }

    private buildAttachmentDisposition(filename: string): string {
        const fallback = filename.replace(/["\\\r\n]/g, '_');
        return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    }
}
