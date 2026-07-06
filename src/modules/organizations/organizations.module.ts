import { Module } from '@nestjs/common';
import { OrganizationsController } from '@/modules/organizations/organizations.controller';
import { OrganizationsRepository } from '@/modules/organizations/repositories/organizations.repository';
import { OrganizationsService } from '@/modules/organizations/services/organizations.service';

@Module({
    controllers: [OrganizationsController],
    providers: [OrganizationsRepository, OrganizationsService],
    exports: [OrganizationsService],
})
export class OrganizationsModule {}
