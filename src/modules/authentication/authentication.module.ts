import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppMailerModule } from '@/mailer/mailer.module';
import { AuthenticationController } from '@/modules/authentication/authentication.controller';
import { AuthenticationService } from '@/modules/authentication/authentication.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { AuthenticationCookiesService } from '@/modules/authentication/services/authentication-cookies.service';
import { AuthenticationTokensService } from '@/modules/authentication/services/authentication-tokens.service';
import { JwtTokenService } from '@/modules/authentication/services/jwt-token.service';
import { JwtStrategy } from '@/modules/authentication/strategies/jwt.strategy';
import * as useCases from '@/modules/authentication/use-cases';

@Module({
    imports: [PassportModule, JwtModule.register({}), AppMailerModule],
    controllers: [AuthenticationController],
    providers: [
        AuthenticationRepository,
        AuthenticationService,
        AuthenticationCookiesService,
        AuthenticationTokensService,
        JwtTokenService,
        JwtStrategy,
        useCases.LoginUseCase,
        useCases.RefreshUseCase,
        useCases.RegisterUseCase,
        useCases.LogoutUseCase,
        useCases.ListSessionsUseCase,
        useCases.RevokeSessionUseCase,
        useCases.GetProfileUseCase,
        useCases.UpdateMyProfileUseCase,
        useCases.ChangePasswordUseCase,
        useCases.RequestPasswordResetUseCase,
        useCases.ResetPasswordUseCase,
        useCases.VerifyEmailUseCase,
        useCases.TwoFactorUseCase,
    ],
    exports: [AuthenticationRepository, AuthenticationCookiesService, AuthenticationTokensService, AuthenticationService],
})
export class AuthenticationModule {}
