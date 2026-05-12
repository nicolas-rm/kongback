import { ValidatorString } from '@/decorators';

export class CreateRoleDto {
    @ValidatorString({ toLowerCase: true })
    code!: string;

    @ValidatorString()
    name!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;
}
