import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { AssignUserAccessDto, CreateUserDto, FindUsersDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersRepository } from '@/modules/users/repositories/users.repository';

@Injectable()
export class UsersService {
    constructor(
        private readonly repository: UsersRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async create(dto: CreateUserDto) {
        return this.repository.create({
            username: dto.username,
            email: dto.email ?? null,
            fullName: dto.fullName,
            passwordHash: await this.cryptoService.hashPassword(dto.password),
            status: dto.status ?? 'active',
        });
    }

    async findAll(dto: FindUsersDto) {
        const where: Prisma.UserWhereInput = {
            deletedAt: null,
            status: dto.status,
            ...(dto.search
                ? {
                      OR: [
                          { username: { contains: dto.search, mode: 'insensitive' } },
                          { email: { contains: dto.search, mode: 'insensitive' } },
                          { fullName: { contains: dto.search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    findOne(id: string) {
        return this.repository.findById(id);
    }

    update(id: string, dto: UpdateUserDto) {
        return this.repository.update(id, {
            username: dto.username,
            email: dto.email,
            fullName: dto.fullName,
            status: dto.status,
            mustChangePassword: dto.mustChangePassword,
        });
    }

    remove(id: string) {
        return this.repository.softDelete(id);
    }

    assignAccess(userId: string, dto: AssignUserAccessDto) {
        return this.repository.assignAccess({
            userId,
            roleId: dto.roleId,
            organizationId: dto.organizationId ?? null,
            scopeKey: dto.scopeKey ?? null,
            scopeId: dto.scopeId ?? null,
        });
    }

    listAccess(userId: string) {
        return this.repository.listAccess(userId);
    }

    removeAccess(userId: string, accessId: string) {
        return this.repository.removeAccess(userId, accessId);
    }
}
