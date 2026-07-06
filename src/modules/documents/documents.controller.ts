import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentCompanyId, CurrentOrganizationId, CurrentUser, Permissions, RequireOrganization } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateDocumentDto, FindDocumentsDto, UpdateDocumentDto } from '@/modules/documents/dto';
import { DocumentsService } from '@/modules/documents/services/documents.service';
import type { UploadedFile as AppUploadedFile } from '@/modules/documents/types/uploaded-file.type';

@RequireOrganization()
@Controller('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Post()
    @Permissions('documents.create')
    @UseInterceptors(FileInterceptor('file'))
    create(
        @CurrentOrganizationId() organizationId: string,
        @CurrentCompanyId() companyId: string | undefined,
        @Body() dto: CreateDocumentDto,
        @UploadedFile() file: AppUploadedFile,
        @CurrentUser() user: RequestUser
    ) {
        return this.documentsService.create(organizationId, dto, file, user.id, companyId);
    }

    @Get()
    @Permissions('documents.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindDocumentsDto) {
        return this.documentsService.findAll(organizationId, dto, companyId);
    }

    @Get(':id/download')
    @Permissions('documents.download')
    @Header('Content-Type', 'application/octet-stream')
    async download(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
        const { document, stream } = await this.documentsService.download(organizationId, id, companyId);
        response.setHeader('Content-Type', document.mimeType);
        response.setHeader('Content-Disposition', this.buildAttachmentDisposition(document.originalName));
        stream.pipe(response);
    }

    @Get(':id')
    @Permissions('documents.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.documentsService.findOne(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('documents.update')
    update(
        @CurrentOrganizationId() organizationId: string,
        @CurrentCompanyId() companyId: string | undefined,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateDocumentDto,
        @CurrentUser() user: RequestUser
    ) {
        return this.documentsService.update(organizationId, id, dto, user.id, companyId);
    }

    @Delete(':id')
    @Permissions('documents.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
        return this.documentsService.remove(organizationId, id, user.id, companyId);
    }

    private buildAttachmentDisposition(filename: string): string {
        const fallback = filename.replace(/["\\\r\n]/g, '_');
        return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    }
}
