import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { AuthCookiesService } from '@/modules/authentication/services/auth-cookies.service';
import { AuthTokensService } from '@/modules/authentication/services/auth-tokens.service';
import { JwtTokenService } from '@/modules/authentication/services/jwt-token.service';
import { JwtStrategy } from '@/modules/authentication/strategies/jwt.strategy';

@Module({
    imports: [PassportModule, JwtModule.register({})],
    providers: [AuthenticationRepository, AuthCookiesService, AuthTokensService, JwtTokenService, JwtStrategy],
    exports: [AuthCookiesService, AuthTokensService],
})
export class AuthenticationModule {}
