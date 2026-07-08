import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentCompanyScope, CurrentUser, Permissions, RequireCompany } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateDocumentDto, FindDocumentsDto, UpdateDocumentDto } from '@/modules/documents/dto';
import { DocumentsService } from '@/modules/documents/services/documents.service';
import type { UploadedFile as AppUploadedFile } from '@/modules/documents/types/uploaded-file.type';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

@RequireCompany()
@Controller('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Post()
    @Permissions('documents.create')
    @UseInterceptors(FileInterceptor('file'))
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateDocumentDto, @UploadedFile() file: AppUploadedFile, @CurrentUser() user: RequestUser) {
        return this.documentsService.create(dto, file, user.id, scope);
    }

    @Get()
    @Permissions('documents.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindDocumentsDto) {
        return this.documentsService.findAll(dto, scope);
    }

    @Get(':id/download')
    @Permissions('documents.download')
    @Header('Content-Type', 'application/octet-stream')
    async download(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
        const { document, stream } = await this.documentsService.download(id, scope);
        response.setHeader('Content-Type', document.mimeType);
        response.setHeader('Content-Disposition', this.buildAttachmentDisposition(document.originalName));
        stream.pipe(response);
    }

    @Get(':id')
    @Permissions('documents.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.documentsService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('documents.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: RequestUser) {
        return this.documentsService.update(id, dto, user.id, scope);
    }

    @Delete(':id')
    @Permissions('documents.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
        return this.documentsService.remove(id, user.id, scope);
    }

    private buildAttachmentDisposition(filename: string): string {
        const fallback = filename.replace(/["\\\r\n]/g, '_');
        return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    }
}
