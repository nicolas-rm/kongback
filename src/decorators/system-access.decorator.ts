import { SetMetadata } from '@nestjs/common';

export const SYSTEM_ACCESS_REQUIRED_KEY = 'systemAccessRequired';
export const SYSTEM_OR_COMPANY_ACCESS_REQUIRED_KEY = 'systemOrCompanyAccessRequired';

export const RequireSystemAccess = () => SetMetadata(SYSTEM_ACCESS_REQUIRED_KEY, true);
export const RequireSystemOrCompanyAccess = () => SetMetadata(SYSTEM_OR_COMPANY_ACCESS_REQUIRED_KEY, true);
