import { SetMetadata } from '@nestjs/common';

export const SYSTEM_ACCESS_REQUIRED_KEY = 'systemAccessRequired';

export const RequireSystemAccess = () => SetMetadata(SYSTEM_ACCESS_REQUIRED_KEY, true);
