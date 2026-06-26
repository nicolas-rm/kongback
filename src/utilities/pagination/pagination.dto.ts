import { ValidatorBoolean, ValidatorNumber, ValidatorString } from '@/decorators';

export class PaginationDto {
    @ValidatorNumber({ optional: true, min: 1 })
    page?: number;

    @ValidatorNumber({ optional: true, min: 1, max: 100 })
    limit?: number;

    @ValidatorString({ optional: true })
    search?: string;

    @ValidatorBoolean({ optional: true })
    all?: boolean;

    get actualPage(): number {
        return this.page ?? 1;
    }

    get actualLimit(): number | undefined {
        return this.limit ?? (this.all ? 100 : 10);
    }

    get skip(): number {
        if (this.all) return 0;
        return (this.actualPage - 1) * (this.limit ?? 10);
    }
}

export type PaginatedResult<T> = {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
};

export function paginate<T>(data: T[], total: number, dto: PaginationDto): PaginatedResult<T> {
    const page = dto.actualPage;
    const limit = dto.all ? total : (dto.actualLimit ?? total);
    const totalPages = total === 0 ? 1 : Math.ceil(total / Math.max(limit, 1));

    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
