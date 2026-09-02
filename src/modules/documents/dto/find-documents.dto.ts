import { PaginationDto } from '@/utilities/pagination/pagination.dto';
import { ValidatorString, ValidatorUUID } from '@/decorators';

export class FindDocumentsDto extends PaginationDto {
    @ValidatorString({ optional: true })
    category?: string;

    @ValidatorUUID({ optional: true })
    subCompanyId?: string;

    @ValidatorString({ optional: true })
    entityType?: string;

    @ValidatorString({ optional: true })
    entityId?: string;
}
