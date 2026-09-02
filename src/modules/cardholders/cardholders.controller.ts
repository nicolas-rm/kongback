import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { setExcelAttachmentHeaders } from '@/utilities/export/excel-export';
import { CardholdersService } from '@/modules/cardholders/cardholders.service';
import { FindCardholdersDto } from '@/modules/cardholders/dto';

@RequireCompany()
@Controller('cardholders')
export class CardholdersController {
    constructor(private readonly cardholdersService: CardholdersService) {}

    @Get()
    @Permissions('cardholders.read-list')
    findAll(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindCardholdersDto) {
        return this.cardholdersService.findAll(dto, scope);
    }

    @Get('export')
    @Permissions('cardholders.read-list')
    async exportList(@CurrentCompanyScope() scope: CompanyScope | undefined, @Query() dto: FindCardholdersDto, @Res({ passthrough: true }) response: Response) {
        const file = await this.cardholdersService.exportList(dto, scope);
        setExcelAttachmentHeaders(response, file);
        return new StreamableFile(file.buffer);
    }
}
