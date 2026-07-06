import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyId, CurrentOrganizationId, Permissions, RequireOrganization } from '@/decorators';
import { AssignCardVehicleDto, CreateCardDto, FindCardsDto, FindStatusRecordsDto, UpdateCardDto } from '@/modules/business/dto';
import { CardsService } from '@/modules/business/services/cards.service';

@RequireOrganization()
@Controller('cards')
export class CardsController {
    constructor(private readonly cardsService: CardsService) {}

    @Post()
    @Permissions('cards.create')
    create(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Body() dto: CreateCardDto) {
        return this.cardsService.create(organizationId, dto, companyId);
    }

    @Get()
    @Permissions('cards.read-list')
    findAll(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Query() dto: FindCardsDto) {
        return this.cardsService.findAll(organizationId, dto, companyId);
    }

    @Get('by-design-fuel/:designFuelId')
    @Permissions('cards.design-fuel.read')
    findByDesignFuel(
        @CurrentOrganizationId() organizationId: string,
        @CurrentCompanyId() companyId: string | undefined,
        @Param('designFuelId', ParseUUIDPipe) designFuelId: string,
        @Query() dto: FindStatusRecordsDto
    ) {
        return this.cardsService.findByDesignFuel(organizationId, designFuelId, dto, companyId);
    }

    @Get(':id')
    @Permissions('cards.read-one')
    findOne(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.findOne(organizationId, id, companyId);
    }

    @Patch(':id/assign-vehicle')
    @Permissions('cards.vehicle.assign')
    assignVehicle(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignCardVehicleDto) {
        return this.cardsService.assignVehicle(organizationId, id, dto, companyId);
    }

    @Patch(':id/unassign')
    @Permissions('cards.unassign')
    unassign(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.unassign(organizationId, id, companyId);
    }

    @Patch(':id')
    @Permissions('cards.update')
    update(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) {
        return this.cardsService.update(organizationId, id, dto, companyId);
    }

    @Delete(':id')
    @Permissions('cards.delete')
    remove(@CurrentOrganizationId() organizationId: string, @CurrentCompanyId() companyId: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
        return this.cardsService.deactivate(organizationId, id, companyId);
    }
}
