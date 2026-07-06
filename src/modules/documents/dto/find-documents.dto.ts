import { PaginationDto } from '@/utilities/pagination/pagination.dto';
import { ValidatorString } from '@/decorators';

export class FindDocumentsDto extends PaginationDto {
    @ValidatorString({ optional: true })
    category?: string;

    @ValidatorString({ optional: true })
    entityType?: string;

    @ValidatorString({ optional: true })
    entityId?: string;
}
