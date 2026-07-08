import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ValidatorEnum, ValidatorPassword, ValidatorString } from '@/decorators';
import { AssignUserAccessDto } from '@/modules/users/dto/assign-user-access.dto';

export class CreateUserDto {
    @ValidatorString()
    username!: string;

    @ValidatorString({ toLowerCase: true })
    email!: string;

    @ValidatorString()
    fullName!: string;

    @IsOptional()
    @ValidatorPassword()
    password?: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorString({ optional: true, toLowerCase: true })
    preferredLanguage?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => AssignUserAccessDto)
    access?: AssignUserAccessDto;
}
