import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const ORGANIZATION_CONTEXT_REQUIRED_KEY = 'organizationContextRequired';

export type OrganizationRequest = Request & { organizationId?: string };

export const RequireOrganization = () => SetMetadata(ORGANIZATION_CONTEXT_REQUIRED_KEY, true);

export const CurrentOrganizationId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<OrganizationRequest>();
    return request.organizationId;
});
