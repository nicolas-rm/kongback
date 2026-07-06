import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { invalidRelation, notFound, textSearch } from '@/modules/business/business.helpers';
import { AddOrganizationMemberDto, CreateOrganizationDto, FindOrganizationsDto, UpdateOrganizationDto } from '@/modules/organizations/dto';
import { OrganizationsRepository } from '@/modules/organizations/repositories/organizations.repository';
import { OrganizationMemberResponse, OrganizationResponse } from '@/modules/organizations/responses';
import { paginate } from '@/utilities/pagination/pagination.dto';

@Injectable()
export class OrganizationsService {
    constructor(private readonly repository: OrganizationsRepository) {}

    async create(dto: CreateOrganizationDto, actorUserId?: string) {
        const organization = await this.repository.create({
            name: dto.name,
            slug: dto.slug,
            description: dto.description ?? null,
            status: dto.status ?? Status.active,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
        });

        return OrganizationResponse.from(organization);
    }

    async findAll(dto: FindOrganizationsDto) {
        const where: Prisma.OrganizationWhereInput = {
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.OrganizationWhereInput>(dto.search, ['name', 'slug', 'description']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(
            data.map((organization) => OrganizationResponse.from(organization)),
            total,
            dto
        );
    }

    async findOne(id: string) {
        const organization = await this.repository.findById(id);
        if (!organization) throw notFound();

        return OrganizationResponse.from(organization);
    }

    async update(id: string, dto: UpdateOrganizationDto, actorUserId?: string) {
        const organization = await this.repository.update(id, {
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            status: dto.status,
            updatedByUserId: actorUserId,
        });
        if (!organization) throw notFound();

        return OrganizationResponse.from(organization);
    }

    async deactivate(id: string, actorUserId?: string) {
        const organization = await this.repository.deactivate(id, actorUserId);
        if (!organization) throw notFound();

        return { id: organization.id, status: organization.status };
    }

    async listMembers(id: string) {
        await this.assertOrganizationExists(id);
        const members = await this.repository.listMembers(id);

        return members.map((member) => OrganizationMemberResponse.from(member));
    }

    async addMember(id: string, dto: AddOrganizationMemberDto) {
        await this.assertActiveOrganization(id);
        await this.assertActiveUser(dto.userId);

        const member = await this.repository.addMember(id, dto.userId);
        return OrganizationMemberResponse.from(member);
    }

    async removeMember(id: string, membershipId: string) {
        await this.assertOrganizationExists(id);
        const result = await this.repository.removeMember(id, membershipId);
        if (result.count === 0) throw notFound();

        return { id: membershipId, deleted: true };
    }

    private async assertOrganizationExists(id: string): Promise<void> {
        const organization = await this.repository.findById(id);
        if (!organization) throw notFound();
    }

    private async assertActiveOrganization(id: string): Promise<void> {
        const count = await this.repository.countActiveOrganizations([id]);
        if (count !== 1) throw invalidRelation();
    }

    private async assertActiveUser(id: string): Promise<void> {
        const count = await this.repository.countActiveUsers([id]);
        if (count !== 1) throw invalidRelation();
    }
}
