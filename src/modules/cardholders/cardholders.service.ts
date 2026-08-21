import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { SUB_COMPANY_SCOPE_KEY, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { FindCardholdersDto } from '@/modules/cardholders/dto';
import { CardholdersRepository, type CardholderUserRecord } from '@/modules/cardholders/repositories/cardholders.repository';

const CARDHOLDER_PERMISSION_PREFIX = 'cardholder.';

@Injectable()
export class CardholdersService {
    constructor(private readonly repository: CardholdersRepository) {}

    async findAll(dto: FindCardholdersDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const [records, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);

        return paginate(
            records.map((record) => this.serialize(record, scope)),
            total,
            dto
        );
    }

    private buildWhere(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.UserWhereInput {
        const driverScope = this.driverScopeWhere(dto, scope);
        const cardFilter: Prisma.VehicleWhereInput = { subCompany: subCompanyScopeWhere(scope), card: { isNot: null } };
        if (dto.subCompanyId) cardFilter.subCompanyId = dto.subCompanyId;

        const and: Prisma.UserWhereInput[] = [{ accesses: { some: this.cardholderAccessWhere(dto, scope) } }];
        if (dto.status) and.push({ status: dto.status });
        if (dto.hasDriver === true) and.push({ driver: { is: driverScope } });
        if (dto.hasDriver === false) and.push({ OR: [{ driver: null }, { driver: { isNot: driverScope } }] });
        if (dto.hasCards === true) and.push({ driver: { is: { ...driverScope, vehicles: { some: cardFilter } } } });
        if (dto.hasCards === false) and.push({ OR: [{ driver: null }, { driver: { is: { ...driverScope, vehicles: { none: cardFilter } } } }, { driver: { isNot: driverScope } }] });
        if (dto.search) {
            and.push({
                OR: [
                    { username: { contains: dto.search, mode: 'insensitive' } },
                    { email: { contains: dto.search, mode: 'insensitive' } },
                    { fullName: { contains: dto.search, mode: 'insensitive' } },
                    { driver: { is: { name: { contains: dto.search, mode: 'insensitive' } } } },
                    { driver: { is: { subCompany: { name: { contains: dto.search, mode: 'insensitive' } } } } },
                    { driver: { is: { subCompany: { key: { contains: dto.search, mode: 'insensitive' } } } } },
                ],
            });
        }

        return { AND: and };
    }

    private cardholderAccessWhere(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.UserAccessWhereInput {
        return {
            companyId: scope?.companyId,
            company: { status: Status.active },
            role: {
                permissions: {
                    some: {
                        permission: {
                            code: { startsWith: CARDHOLDER_PERMISSION_PREFIX },
                        },
                    },
                },
            },
            ...(scope?.subCompanyIds ? { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds } } : {}),
            ...(dto.subCompanyId ? { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: dto.subCompanyId } : {}),
        };
    }

    private driverScopeWhere(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.DriverWhereInput {
        return {
            subCompany: subCompanyScopeWhere(scope),
            ...(dto.subCompanyId ? { subCompanyId: dto.subCompanyId } : {}),
        };
    }

    private serialize(record: CardholderUserRecord, scope?: CompanyScope) {
        const driver = this.isDriverVisible(record.driver, scope) ? record.driver : null;
        const vehicles = driver?.vehicles.filter((vehicle) => this.isSubCompanyVisible(vehicle.subCompanyId, scope)) ?? [];
        const cards = vehicles.map((vehicle) => vehicle.card).filter((card): card is NonNullable<(typeof vehicles)[number]['card']> => Boolean(card));

        return {
            id: record.id,
            username: record.username,
            email: record.email,
            fullName: record.fullName,
            status: record.status,
            isOperational: Boolean(driver && vehicles.length > 0 && cards.length > 0),
            counts: {
                vehicles: vehicles.length,
                cards: cards.length,
            },
            accesses: record.accesses
                .filter((access) => this.isCardholderAccessVisible(access, scope))
                .map((access) => ({
                    id: access.id,
                    companyId: access.companyId,
                    scopeKey: access.scopeKey,
                    scopeId: access.scopeId,
                    role: {
                        id: access.role.id,
                        code: access.role.code,
                        name: access.role.name,
                    },
                })),
            driver: driver
                ? {
                      id: driver.id,
                      subCompanyId: driver.subCompanyId,
                      name: driver.name,
                      externalReference: driver.externalReference,
                      status: driver.status,
                      subCompany: driver.subCompany,
                  }
                : null,
            vehicles: vehicles.map((vehicle) => ({
                id: vehicle.id,
                subCompanyId: vehicle.subCompanyId,
                plates: vehicle.plates,
                economicNumber: vehicle.economicNumber,
                status: vehicle.status,
                card: vehicle.card
                    ? {
                          id: vehicle.card.id,
                          externalId: vehicle.card.externalId,
                          status: vehicle.card.status,
                          stock: vehicle.card.stock,
                      }
                    : null,
            })),
        };
    }

    private isDriverVisible(driver: CardholderUserRecord['driver'], scope?: CompanyScope): driver is NonNullable<CardholderUserRecord['driver']> {
        if (!driver) return false;
        if (scope?.companyId && driver.subCompany.companyId !== scope.companyId) return false;
        return this.isSubCompanyVisible(driver.subCompanyId, scope);
    }

    private isSubCompanyVisible(subCompanyId: string, scope?: CompanyScope): boolean {
        return !scope?.subCompanyIds || scope.subCompanyIds.includes(subCompanyId);
    }

    private isCardholderAccessVisible(access: CardholderUserRecord['accesses'][number], scope?: CompanyScope): boolean {
        const hasCardholderPermission = access.role.permissions.some((entry) => entry.permission.code.startsWith(CARDHOLDER_PERMISSION_PREFIX));
        if (!hasCardholderPermission) return false;
        if (scope?.companyId && access.companyId !== scope.companyId) return false;
        if (!scope?.subCompanyIds) return true;
        return access.scopeKey === SUB_COMPANY_SCOPE_KEY && typeof access.scopeId === 'string' && scope.subCompanyIds.includes(access.scopeId);
    }
}
