import { Injectable } from '@nestjs/common';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';
import { ChangePasswordDto, LoginDto, LogoutDto, RefreshTokenDto, RequestPasswordResetDto, ResetPasswordDto, TwoFactorCodeDto } from '@/modules/authentication/dto';
import {
    ChangePasswordUseCase,
    GetProfileUseCase,
    ListSessionsUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    TwoFactorUseCase,
} from '@/modules/authentication/use-cases';

@Injectable()
export class AuthenticationService {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshUseCase: RefreshUseCase,
        private readonly logoutUseCase: LogoutUseCase,
        private readonly listSessionsUseCase: ListSessionsUseCase,
        private readonly getProfileUseCase: GetProfileUseCase,
        private readonly changePasswordUseCase: ChangePasswordUseCase,
        private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
        private readonly resetPasswordUseCase: ResetPasswordUseCase,
        private readonly twoFactorUseCase: TwoFactorUseCase
    ) {}

    login(dto: LoginDto, sessionContext?: SessionContext) {
        return this.loginUseCase.execute(dto, sessionContext);
    }

    refresh(dto: RefreshTokenDto, sessionContext?: SessionContext) {
        return this.refreshUseCase.execute(dto, sessionContext);
    }

    logout(userId: string, dto: LogoutDto) {
        return this.logoutUseCase.execute(userId, dto);
    }

    getProfile(user: RequestUser, refreshToken?: string) {
        return this.getProfileUseCase.execute(user, refreshToken);
    }

    listSessions(userId: string, refreshToken?: string) {
        return this.listSessionsUseCase.execute(userId, refreshToken);
    }

    changePassword(userId: string, dto: ChangePasswordDto) {
        return this.changePasswordUseCase.execute(userId, dto);
    }

    requestPasswordReset(dto: RequestPasswordResetDto, sessionContext?: SessionContext) {
        return this.requestPasswordResetUseCase.execute(dto, sessionContext);
    }

    resetPassword(dto: ResetPasswordDto) {
        return this.resetPasswordUseCase.execute(dto);
    }

    getTwoFactorStatus(userId: string) {
        return this.twoFactorUseCase.status(userId);
    }

    beginTwoFactorSetup(userId: string) {
        return this.twoFactorUseCase.beginSetup(userId);
    }

    enableTwoFactor(userId: string, dto: TwoFactorCodeDto) {
        return this.twoFactorUseCase.enable(userId, dto);
    }

    disableTwoFactor(userId: string, dto: TwoFactorCodeDto) {
        return this.twoFactorUseCase.disable(userId, dto);
    }

    regenerateTwoFactorRecoveryCodes(userId: string, dto: TwoFactorCodeDto) {
        return this.twoFactorUseCase.regenerateRecoveryCodes(userId, dto);
    }
}
