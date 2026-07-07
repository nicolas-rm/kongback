export const I18N_KEYS = {
    errors: {
        authentication: {
            invalidCredentials: 'errors.authentication.invalidCredentials',
            accountLocked: 'errors.authentication.accountLocked',
            emailVerificationRequired: 'errors.authentication.emailVerificationRequired',
            invalidTwoFactorChallenge: 'errors.authentication.invalidTwoFactorChallenge',
            invalidTwoFactorCode: 'errors.authentication.invalidTwoFactorCode',
            invalidRefreshToken: 'errors.authentication.invalidRefreshToken',
            reusedRefreshToken: 'errors.authentication.reusedRefreshToken',
            expiredRefreshToken: 'errors.authentication.expiredRefreshToken',
            unauthorizedUser: 'errors.authentication.unauthorizedUser',
            invalidCurrentPassword: 'errors.authentication.invalidCurrentPassword',
            invalidVerificationToken: 'errors.authentication.invalidVerificationToken',
            invalidResetToken: 'errors.authentication.invalidResetToken',
            twoFactorPendingNotFound: 'errors.authentication.twoFactorPendingNotFound',
            twoFactorSetupExpired: 'errors.authentication.twoFactorSetupExpired',
            twoFactorNotEnabled: 'errors.authentication.twoFactorNotEnabled',
        },
        authorization: {
            unauthorized: 'errors.authorization.unauthorized',
            insufficientPermissions: 'errors.authorization.insufficientPermissions',
            companyDenied: 'errors.authorization.companyDenied',
            mustChangePassword: 'errors.authorization.mustChangePassword',
        },
        documents: {
            notFound: 'errors.documents.notFound',
            fileRequired: 'errors.documents.fileRequired',
            fileTooLarge: 'errors.documents.fileTooLarge',
            mimeTypeNotAllowed: 'errors.documents.mimeTypeNotAllowed',
            storageFileNotFound: 'errors.documents.storageFileNotFound',
            invalidFilePath: 'errors.documents.invalidFilePath',
        },
        notifications: {
            notFound: 'errors.notifications.notFound',
        },
        users: {
            notFound: 'errors.users.notFound',
        },
        validation: {
            invalidData: 'errors.validation.invalidData',
        },
        internal: {
            unprocessed: 'errors.internal.unprocessed',
        },
    },
    mail: {
        passwordReset: {
            subject: 'errors.mail.passwordReset.subject',
            title: 'errors.mail.passwordReset.title',
            body: 'errors.mail.passwordReset.body',
            action: 'errors.mail.passwordReset.action',
        },
        welcomeCredentials: {
            subject: 'errors.mail.welcomeCredentials.subject',
            title: 'errors.mail.welcomeCredentials.title',
            body: 'errors.mail.welcomeCredentials.body',
        },
        emailVerification: {
            subject: 'errors.mail.emailVerification.subject',
            title: 'errors.mail.emailVerification.title',
            body: 'errors.mail.emailVerification.body',
            action: 'errors.mail.emailVerification.action',
        },
    },
    prisma: {
        uniqueConstraint: 'errors.prisma.uniqueConstraint',
        invalidRelation: 'errors.prisma.invalidRelation',
        valueTooLong: 'errors.prisma.valueTooLong',
        recordNotFound: 'errors.prisma.recordNotFound',
        invalidData: 'errors.prisma.invalidData',
        internalFailure: 'errors.prisma.internalFailure',
        unknownField: 'errors.prisma.unknownField',
    },
    socket: {
        unauthorized: 'errors.socket.unauthorized',
    },
    validation: {
        required: 'validation.required',
        string: 'validation.string',
        minLength: 'validation.minLength',
        maxLength: 'validation.maxLength',
        password: 'validation.password',
        boolean: 'validation.boolean',
        array: 'validation.array',
        minItems: 'validation.minItems',
        maxItems: 'validation.maxItems',
        date: 'validation.date',
        isoDate: 'validation.isoDate',
        enum: 'validation.enum',
        integer: 'validation.integer',
        number: 'validation.number',
        minValue: 'validation.minValue',
        maxValue: 'validation.maxValue',
        uuid: 'validation.uuid',
    },
} as const;

type NestedValues<T> = T extends string ? T : { [K in keyof T]: NestedValues<T[K]> }[keyof T];

export type I18nKey = NestedValues<typeof I18N_KEYS>;
