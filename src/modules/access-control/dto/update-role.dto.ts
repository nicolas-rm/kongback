import { ValidatorString } from '@/decorators';

export class UpdateRoleDto {
    @ValidatorString({ optional: true, toLowerCase: true })
    code?: string;

    @ValidatorString({ optional: true })
    name?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;
}
