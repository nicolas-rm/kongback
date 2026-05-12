import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@/modules/users/repositories/users.repository';

@Injectable()
export class UsersService {
    constructor(private readonly repository: UsersRepository) {}
}
