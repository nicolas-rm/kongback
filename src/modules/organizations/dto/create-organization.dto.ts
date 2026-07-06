import { Status } from '@prisma/client';
import { ValidatorEnum, ValidatorString } from '@/decorators';

export class CreateOrganizationDto {
    @ValidatorString()
    name!: string;

    @ValidatorString({ toLowerCase: true })
    slug!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}
