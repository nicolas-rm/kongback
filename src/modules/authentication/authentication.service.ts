import { Injectable } from '@nestjs/common';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';
import {
    ChangePasswordDto,
    LoginDto,
    LogoutDto,
    RefreshTokenDto,
    RegisterDto,
    RequestPasswordResetDto,
    ResetPasswordDto,
    TwoFactorCodeDto,
    UpdateMyProfileDto,
    VerifyEmailDto,
    VerifyTwoFactorLoginDto,
} from '@/modules/authentication/dto';
import {
    ChangePasswordUseCase,
    GetProfileUseCase,
    ListSessionsUseCase,
    ListWorkspacesUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshUseCase,
    RegisterUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    RevokeSessionUseCase,
    TwoFactorUseCase,
    UpdateMyProfileUseCase,
    VerifyEmailUseCase,
} from '@/modules/authentication/use-cases';

@Injectable()
export class AuthenticationService {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshUseCase: RefreshUseCase,
        private readonly registerUseCase: RegisterUseCase,
        private readonly logoutUseCase: LogoutUseCase,
        private readonly listSessionsUseCase: ListSessionsUseCase,
        private readonly revokeSessionUseCase: RevokeSessionUseCase,
        private readonly getProfileUseCase: GetProfileUseCase,
        private readonly listWorkspacesUseCase: ListWorkspacesUseCase,
        private readonly updateMyProfileUseCase: UpdateMyProfileUseCase,
        private readonly changePasswordUseCase: ChangePasswordUseCase,
        private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
        private readonly resetPasswordUseCase: ResetPasswordUseCase,
        private readonly verifyEmailUseCase: VerifyEmailUseCase,
        private readonly twoFactorUseCase: TwoFactorUseCase
    ) {}

    login(dto: LoginDto, sessionContext?: SessionContext) {
        return this.loginUseCase.execute(dto, sessionContext);
    }

    verifyTwoFactorLogin(dto: VerifyTwoFactorLoginDto, sessionContext?: SessionContext) {
        return this.loginUseCase.verifyTwoFactorLogin(dto, sessionContext);
    }

    register(dto: RegisterDto, sessionContext?: SessionContext) {
        return this.registerUseCase.execute(dto, sessionContext);
    }

    refresh(dto: RefreshTokenDto, sessionContext?: SessionContext) {
        return this.refreshUseCase.execute(dto, sessionContext);
    }

    logout(userId: string, dto: LogoutDto) {
        return this.logoutUseCase.execute(userId, dto);
    }

    logoutAll(userId: string) {
        return this.logoutUseCase.execute(userId, {});
    }

    getProfile(user: RequestUser) {
        return this.getProfileUseCase.execute(user);
    }

    updateProfile(user: RequestUser, dto: UpdateMyProfileDto) {
        return this.updateMyProfileUseCase.execute(user, dto);
    }

    listSessions(userId: string, refreshToken?: string) {
        return this.listSessionsUseCase.execute(userId, refreshToken);
    }

    listWorkspaces(user: RequestUser) {
        return this.listWorkspacesUseCase.execute(user);
    }

    revokeSession(userId: string, sessionId: string, refreshToken?: string) {
        return this.revokeSessionUseCase.execute(userId, sessionId, refreshToken);
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

    requestEmailVerification(email: string, sessionContext?: SessionContext) {
        return this.registerUseCase.resendVerification(email, sessionContext);
    }

    verifyEmail(dto: VerifyEmailDto) {
        return this.verifyEmailUseCase.execute(dto);
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

    resetTwoFactor(userId: string) {
        return this.twoFactorUseCase.reset(userId);
    }
}
