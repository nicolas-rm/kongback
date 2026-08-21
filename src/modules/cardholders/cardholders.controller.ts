import { Controller, Get, Query } from '@nestjs/common';
import { CurrentCompanyScope, Permissions, RequireCompany } from '@/decorators';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
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
}
