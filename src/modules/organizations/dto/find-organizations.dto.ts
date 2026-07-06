import { Status } from '@prisma/client';
import { ValidatorEnum } from '@/decorators';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';

export class FindOrganizationsDto extends PaginationDto {
    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}
