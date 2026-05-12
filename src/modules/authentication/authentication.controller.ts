import { Body, Controller, Get, HttpStatus, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public, RefreshToken, RequestConfig, SessionContextData, SkipMustChangePassword } from '@/decorators';
import { AuthenticationService } from '@/modules/authentication/authentication.service';
import { AuthCookiesService } from '@/modules/authentication/services/auth-cookies.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';
import { ChangePasswordDto, LoginDto, RefreshTokenDto, RequestPasswordResetDto, ResetPasswordDto, TwoFactorCodeDto } from '@/modules/authentication/dto';

@Controller('auth')
export class AuthenticationController {
    constructor(
        private readonly authenticationService: AuthenticationService,
        private readonly authCookiesService: AuthCookiesService
    ) {}

    @Post('login')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: true })
    async login(@Body() dto: LoginDto, @SessionContextData() sessionContext: SessionContext, @Res({ passthrough: true }) response: Response) {
        const tokens = await this.authenticationService.login(dto, sessionContext);
        this.authCookiesService.setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
        return tokens;
    }

    @Post('refresh')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: true })
    async refresh(
        @Body() dto: RefreshTokenDto,
        @RefreshToken() refreshToken: string | undefined,
        @SessionContextData() sessionContext: SessionContext,
        @Res({ passthrough: true }) response: Response
    ) {
        const tokens = await this.authenticationService.refresh({ refreshToken: dto.refreshToken ?? refreshToken }, sessionContext);
        this.authCookiesService.setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
        return tokens;
    }

    @Post('logout')
    @RequestConfig({ statusCode: HttpStatus.OK })
    @SkipMustChangePassword()
    async logout(@CurrentUser() user: RequestUser, @RefreshToken() refreshToken: string | undefined, @Res({ passthrough: true }) response: Response) {
        this.authCookiesService.clearAuthCookies(response);
        return this.authenticationService.logout(user.id, { refreshToken });
    }

    @Get('me')
    @SkipMustChangePassword()
    me(@CurrentUser() user: RequestUser, @RefreshToken() refreshToken: string | undefined) {
        return this.authenticationService.getProfile(user, refreshToken);
    }

    @Get('sessions')
    @SkipMustChangePassword()
    sessions(@CurrentUser() user: RequestUser, @RefreshToken() refreshToken: string | undefined) {
        return this.authenticationService.listSessions(user.id, refreshToken);
    }

    @Patch('password')
    @SkipMustChangePassword()
    changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
        this.authCookiesService.clearAuthCookies(response);
        return this.authenticationService.changePassword(user.id, dto);
    }

    @Post('password/reset/request')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: true })
    requestPasswordReset(@Body() dto: RequestPasswordResetDto, @SessionContextData() sessionContext: SessionContext) {
        return this.authenticationService.requestPasswordReset(dto, sessionContext);
    }

    @Post('password/reset')
    @Public()
    @RequestConfig({ statusCode: HttpStatus.OK, throttle: true })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authenticationService.resetPassword(dto);
    }

    @Get('2fa/status')
    @SkipMustChangePassword()
    getTwoFactorStatus(@CurrentUser() user: RequestUser) {
        return this.authenticationService.getTwoFactorStatus(user.id);
    }

    @Post('2fa/setup')
    @SkipMustChangePassword()
    beginTwoFactorSetup(@CurrentUser() user: RequestUser) {
        return this.authenticationService.beginTwoFactorSetup(user.id);
    }

    @Post('2fa/enable')
    @SkipMustChangePassword()
    enableTwoFactor(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto) {
        return this.authenticationService.enableTwoFactor(user.id, dto);
    }

    @Post('2fa/disable')
    @SkipMustChangePassword()
    disableTwoFactor(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto) {
        return this.authenticationService.disableTwoFactor(user.id, dto);
    }

    @Post('2fa/recovery-codes/regenerate')
    @SkipMustChangePassword()
    regenerateRecoveryCodes(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto) {
        return this.authenticationService.regenerateTwoFactorRecoveryCodes(user.id, dto);
    }
}
