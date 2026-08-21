import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';

@RequireCompany()
@Controller('sub-companies')
export class SubCompaniesController {
    constructor(private readonly subCompaniesService: SubCompaniesService) {}

    @Post()
    @Permissions('sub-companies.create')
    create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateSubCompanyDto) {
        return this.subCompaniesService.create(dto, scope);
    }

    @Get()
    @Permissions('sub-companies.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindSubCompaniesDto) {
        return this.subCompaniesService.findAll(dto, scope);
    }

    @Get(':id/drivers/download')
    @Permissions('drivers.download')
    async downloadDrivers(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) response: Response) {
        const file = await this.subCompaniesService.downloadDrivers(id, scope);
        this.setDownloadHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id/vehicles/download')
    @Permissions('vehicles.download')
    async downloadVehicles(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) response: Response) {
        const file = await this.subCompaniesService.downloadVehicles(id, scope);
        this.setDownloadHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id/cards/download')
    @Permissions('cards.download')
    async downloadCards(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) response: Response) {
        const file = await this.subCompaniesService.downloadCards(id, scope);
        this.setDownloadHeaders(response, file);
        return new StreamableFile(file.buffer);
    }

    @Get(':id')
    @Permissions('sub-companies.read-one')
    findOne(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.findOne(id, scope);
    }

    @Patch(':id')
    @Permissions('sub-companies.update')
    update(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubCompanyDto) {
        return this.subCompaniesService.update(id, dto, scope);
    }

    @Delete(':id')
    @Permissions('sub-companies.delete')
    remove(@CurrentCompanyScope() scope: CompanyScope | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.subCompaniesService.deactivate(id, scope);
    }

    private setDownloadHeaders(response: Response, file: { filename: string; mimeType: string; buffer: Buffer }): void {
        response.setHeader('Content-Type', file.mimeType);
        response.setHeader('Content-Disposition', this.buildAttachmentDisposition(file.filename));
        response.setHeader('Content-Length', String(file.buffer.length));
    }

    private buildAttachmentDisposition(filename: string): string {
        const fallback = filename.replace(/["\\\r\n]/g, '_');
        return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    }
}
