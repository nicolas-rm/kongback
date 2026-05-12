import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthCookiesService } from '@/modules/authentication/auth-cookies.service';
import { AuthTokensService } from '@/modules/authentication/auth-tokens.service';
import { JwtStrategy } from '@/modules/authentication/strategies/jwt.strategy';

@Module({
    imports: [PassportModule, JwtModule.register({})],
    providers: [AuthCookiesService, AuthTokensService, JwtStrategy],
    exports: [AuthCookiesService, AuthTokensService],
})
export class AuthenticationModule {}
