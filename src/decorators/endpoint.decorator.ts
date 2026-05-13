import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/decorators/public.decorator';

type RequestConfigOptions = {
    statusCode?: HttpStatus | number;
    isPublic?: boolean;
    throttle?: boolean | { limit: number; ttl: number };
};

export function RequestConfig(options: RequestConfigOptions = {}) {
    const { statusCode = HttpStatus.OK, isPublic = false, throttle = false } = options;
    const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [HttpCode(statusCode)];

    if (isPublic) decorators.push(Public());
    if (throttle) {
        const throttleOptions = typeof throttle === 'object' ? throttle : { limit: 5, ttl: 60_000 };
        decorators.push(Throttle({ default: throttleOptions }));
    }

    return applyDecorators(...decorators);
}
