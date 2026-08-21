import { Status } from '@prisma/client';
import { ValidatorBoolean, ValidatorEnum, ValidatorUUID } from '@/decorators';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';

export class FindCardholdersDto extends PaginationDto {
    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorUUID({ optional: true })
    subCompanyId?: string;

    @ValidatorBoolean({ optional: true })
    hasDriver?: boolean;

    @ValidatorBoolean({ optional: true })
    hasCards?: boolean;
}
