import { SetMetadata } from '@nestjs/common';

export const GLOBAL_ACCESS_REQUIRED_KEY = 'globalAccessRequired';

export const RequireGlobalAccess = () => SetMetadata(GLOBAL_ACCESS_REQUIRED_KEY, true);
