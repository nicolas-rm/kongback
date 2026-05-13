import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, Permissions } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateDocumentDto, FindDocumentsDto, UpdateDocumentDto } from '@/modules/documents/dto';
import { DocumentsService } from '@/modules/documents/services/documents.service';
import type { UploadedFile as AppUploadedFile } from '@/modules/documents/types/uploaded-file.type';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Post()
    @Permissions('documents.create')
    @UseInterceptors(FileInterceptor('file'))
    create(@Body() dto: CreateDocumentDto, @UploadedFile() file: AppUploadedFile, @CurrentUser() user: RequestUser) {
        return this.documentsService.create(dto, file, user.id);
    }

    @Get()
    @Permissions('documents.read-list')
    findAll(@Query() dto: FindDocumentsDto) {
        return this.documentsService.findAll(dto);
    }

    @Get(':id/download')
    @Permissions('documents.download')
    @Header('Content-Type', 'application/octet-stream')
    async download(@Param('id') id: string, @Res() response: Response) {
        const { document, stream } = await this.documentsService.download(id);
        response.setHeader('Content-Type', document.mimeType);
        response.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        stream.pipe(response);
    }

    @Get(':id')
    @Permissions('documents.read-one')
    findOne(@Param('id') id: string) {
        return this.documentsService.findOne(id);
    }

    @Patch(':id')
    @Permissions('documents.update')
    update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: RequestUser) {
        return this.documentsService.update(id, dto, user.id);
    }

    @Delete(':id')
    @Permissions('documents.delete')
    remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
        return this.documentsService.remove(id, user.id);
    }
}
