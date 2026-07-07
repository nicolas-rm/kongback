import { Injectable } from '@nestjs/common';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { CompanyAccessResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

type CompanyEntry = {
    id: string;
    key: string;
    name: string;
    isGlobalAdmin: boolean;
    roles: Array<{ id: string; code: string; name: string }>;
};

@Injectable()
export class ListCompaniesUseCase {
    constructor(private readonly repository: AuthenticationRepository) {}

    async execute(user: RequestUser) {
        if (user.isGlobalAdmin) {
            const companies = await this.repository.listActiveCompanies();
            return companies.map((company) => CompanyAccessResponse.from({ ...company, isGlobalAdmin: true, roles: [] }));
        }

        const accesses = await this.repository.listUserCompanyAccesses(user.id);
        const companies = new Map<string, CompanyEntry>();

        for (const access of accesses) {
            if (!access.company) continue;

            const company = companies.get(access.company.id) ?? {
                id: access.company.id,
                key: access.company.key,
                name: access.company.name,
                isGlobalAdmin: false,
                roles: [],
            };

            company.roles.push(access.role);
            companies.set(company.id, company);
        }

        return [...companies.values()].sort((left, right) => left.name.localeCompare(right.name)).map((company) => CompanyAccessResponse.from(company));
    }
}
