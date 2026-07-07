import { Body, Controller, Delete, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentOrganizationId, CurrentUser, Public, RefreshToken, RequestConfig, RequireOrganization, SessionContextData, SkipMustChangePassword } from '@/decorators';
import { AuthenticationService } from '@/modules/authentication/authentication.service';
import { AuthenticationCookiesService } from '@/modules/authentication/services/authentication-cookies.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';
import {
    ChangePasswordDto,
    LoginDto,
    RefreshTokenDto,
    RegisterDto,
    RequestEmailVerificationDto,
    RequestPasswordResetDto,
    ResetPasswordDto,
    TwoFactorCodeDto,
    UpdateMyProfileDto,
    VerifyEmailDto,
    VerifyTwoFactorLoginDto,
} from '@/modules/authentication/dto';

@Controller('authentication')
export class AuthenticationController {
    constructor(
        private readonly authenticationService: AuthenticationService,
        private readonly authenticationCookiesService: AuthenticationCookiesService
    ) {}

    @Post('login')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    async login(@Body() dto: LoginDto, @SessionContextData() sessionContext: SessionContext, @Res({ passthrough: true }) response: Response) {
        const tokens = await this.authenticationService.login(dto, sessionContext);
        if ('requiresTwoFactor' in tokens) {
            this.authenticationCookiesService.clearAuthenticationCookies(response);
            return tokens;
        }
        this.authenticationCookiesService.setAuthenticationCookies(response, tokens.accessToken, tokens.refreshToken);
        return tokens;
    }

    @Post('2fa/verify-login')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    async verifyTwoFactorLogin(@Body() dto: VerifyTwoFactorLoginDto, @SessionContextData() sessionContext: SessionContext, @Res({ passthrough: true }) response: Response) {
        const tokens = await this.authenticationService.verifyTwoFactorLogin(dto, sessionContext);
        this.authenticationCookiesService.setAuthenticationCookies(response, tokens.accessToken, tokens.refreshToken);
        return tokens;
    }

    @Post('register')
    @Public()
    @RequestConfig({ throttle: { limit: 3, ttl: 60_000 } })
    register(@Body() dto: RegisterDto, @SessionContextData() sessionContext: SessionContext) {
        return this.authenticationService.register(dto, sessionContext);
    }

    @Post('refresh')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 20, ttl: 60_000 } })
    async refresh(
        @Body() dto: RefreshTokenDto,
        @RefreshToken() refreshToken: string | undefined,
        @SessionContextData() sessionContext: SessionContext,
        @Res({ passthrough: true }) response: Response
    ) {
        const tokens = await this.authenticationService.refresh({ refreshToken: dto.refreshToken ?? refreshToken }, sessionContext);
        this.authenticationCookiesService.setAuthenticationCookies(response, tokens.accessToken, tokens.refreshToken);
        return tokens;
    }

    @Post('logout')
    @RequestConfig({ statusCode: HttpStatus.OK })
    @SkipMustChangePassword()
    async logout(@CurrentUser() user: RequestUser, @RefreshToken() refreshToken: string | undefined, @Res({ passthrough: true }) response: Response) {
        this.authenticationCookiesService.clearAuthenticationCookies(response);
        return this.authenticationService.logout(user.id, { refreshToken });
    }

    @Post('logout-all')
    @RequestConfig({ statusCode: HttpStatus.OK })
    @SkipMustChangePassword()
    async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) response: Response) {
        this.authenticationCookiesService.clearAuthenticationCookies(response);
        return this.authenticationService.logoutAll(user.id);
    }

    @Get('me')
    @SkipMustChangePassword()
    me(@CurrentUser() user: RequestUser) {
        return this.authenticationService.getProfile(user);
    }

    @Get('workspaces')
    @SkipMustChangePassword()
    workspaces(@CurrentUser() user: RequestUser) {
        return this.authenticationService.listWorkspaces(user);
    }

    @Get('capabilities')
    @RequireOrganization()
    @SkipMustChangePassword()
    capabilities(@CurrentUser() user: RequestUser, @CurrentOrganizationId() organizationId: string) {
        return this.authenticationService.getCapabilities(user, organizationId);
    }

    @Patch('me')
    updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMyProfileDto) {
        return this.authenticationService.updateProfile(user, dto);
    }

    @Get('sessions')
    @SkipMustChangePassword()
    sessions(@CurrentUser() user: RequestUser, @RefreshToken() refreshToken: string | undefined) {
        return this.authenticationService.listSessions(user.id, refreshToken);
    }

    @Delete('sessions/:sessionId')
    @RequestConfig({ statusCode: HttpStatus.OK })
    @SkipMustChangePassword()
    async revokeSession(
        @CurrentUser() user: RequestUser,
        @Param('sessionId', ParseUUIDPipe) sessionId: string,
        @RefreshToken() refreshToken: string | undefined,
        @Res({ passthrough: true }) response: Response
    ) {
        const result = await this.authenticationService.revokeSession(user.id, sessionId, refreshToken);
        if (result.revokedCurrent) this.authenticationCookiesService.clearAuthenticationCookies(response);
        return result;
    }

    @Patch('password')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    @SkipMustChangePassword()
    changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
        this.authenticationCookiesService.clearAuthenticationCookies(response);
        return this.authenticationService.changePassword(user.id, dto);
    }

    @Post('password/reset/request')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 3, ttl: 60_000 } })
    requestPasswordReset(@Body() dto: RequestPasswordResetDto, @SessionContextData() sessionContext: SessionContext) {
        return this.authenticationService.requestPasswordReset(dto, sessionContext);
    }

    @Post('password/reset')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authenticationService.resetPassword(dto);
    }

    @Post('email/verification/request')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 3, ttl: 60_000 } })
    requestEmailVerification(@Body() dto: RequestEmailVerificationDto, @SessionContextData() sessionContext: SessionContext) {
        return this.authenticationService.requestEmailVerification(dto.email, sessionContext);
    }

    @Post('email/verification/confirm')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authenticationService.verifyEmail(dto);
    }

    @Get('2fa/status')
    @SkipMustChangePassword()
    getTwoFactorStatus(@CurrentUser() user: RequestUser) {
        return this.authenticationService.getTwoFactorStatus(user.id);
    }

    @Post('2fa/setup')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 3, ttl: 60_000 } })
    @SkipMustChangePassword()
    beginTwoFactorSetup(@CurrentUser() user: RequestUser) {
        return this.authenticationService.beginTwoFactorSetup(user.id);
    }

    @Post('2fa/enable')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    @SkipMustChangePassword()
    enableTwoFactor(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto) {
        return this.authenticationService.enableTwoFactor(user.id, dto);
    }

    @Post('2fa/disable')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 5, ttl: 60_000 } })
    @SkipMustChangePassword()
    disableTwoFactor(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto) {
        return this.authenticationService.disableTwoFactor(user.id, dto);
    }

    @Post('2fa/recovery-codes/regenerate')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 3, ttl: 60_000 } })
    @SkipMustChangePassword()
    regenerateRecoveryCodes(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto) {
        return this.authenticationService.regenerateTwoFactorRecoveryCodes(user.id, dto);
    }

    @Delete('2fa/reset')
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: { limit: 2, ttl: 60_000 } })
    @SkipMustChangePassword()
    resetTwoFactor(@CurrentUser() user: RequestUser) {
        return this.authenticationService.resetTwoFactor(user.id);
    }
}
