import { Injectable } from '@nestjs/common';
import { OrganizationsRepository } from '@/modules/organizations/repositories/organizations.repository';

@Injectable()
export class OrganizationsService {
    constructor(private readonly organizationsRepository: OrganizationsRepository) {}
}
