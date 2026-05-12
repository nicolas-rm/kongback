import { Module } from '@nestjs/common';
import { OrganizationsRepository } from '@/modules/organizations/repositories/organizations.repository';
import { OrganizationsService } from '@/modules/organizations/services/organizations.service';

@Module({
    providers: [OrganizationsRepository, OrganizationsService],
    exports: [OrganizationsService],
})
export class OrganizationsModule {}
