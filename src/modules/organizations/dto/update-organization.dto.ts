import { Status } from '@prisma/client';
import { ValidatorEnum, ValidatorString } from '@/decorators';

export class UpdateOrganizationDto {
    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorString({ optional: true, toLowerCase: true })
    slug?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}
