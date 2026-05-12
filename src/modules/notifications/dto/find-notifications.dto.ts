import { NotificationType } from '@prisma/client';
import { ValidatorBoolean, ValidatorEnum } from '@/decorators';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';

export class FindNotificationsDto extends PaginationDto {
    @ValidatorBoolean({ optional: true })
    isRead?: boolean;

    @ValidatorEnum(NotificationType, { optional: true })
    type?: NotificationType;
}
