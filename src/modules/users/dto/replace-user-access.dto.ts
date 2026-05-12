import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ValidatorArray } from '@/decorators';
import { AssignUserAccessDto } from '@/modules/users/dto/assign-user-access.dto';

export class ReplaceUserAccessDto {
    @ValidatorArray({ preserveEmptyArray: true })
    @ValidateNested({ each: true })
    @Type(() => AssignUserAccessDto)
    accesses!: AssignUserAccessDto[];
}
