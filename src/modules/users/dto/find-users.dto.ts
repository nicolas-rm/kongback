import { UserStatus } from '@prisma/client';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';
import { ValidatorEnum } from '@/decorators';

export class FindUsersDto extends PaginationDto {
    @ValidatorEnum(UserStatus, { optional: true })
    status?: UserStatus;
}
