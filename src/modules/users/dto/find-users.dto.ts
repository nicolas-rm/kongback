import { Status } from '@prisma/client';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';
import { ValidatorEnum } from '@/decorators';

export class FindUsersDto extends PaginationDto {
    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}
