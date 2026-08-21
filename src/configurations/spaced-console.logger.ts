import { ConsoleLogger, Injectable, type LogLevel } from '@nestjs/common';

const ANSI_COLORS = {
    black: ['\x1b[30m', '\x1b[39m'],
    blue: ['\x1b[34m', '\x1b[39m'],
    cyan: ['\x1b[36m', '\x1b[39m'],
    gray: ['\x1b[90m', '\x1b[39m'],
    green: ['\x1b[32m', '\x1b[39m'],
    magenta: ['\x1b[35m', '\x1b[39m'],
    red: ['\x1b[31m', '\x1b[39m'],
    white: ['\x1b[37m', '\x1b[39m'],
    yellow: ['\x1b[33m', '\x1b[39m'],
} as const;

const ANSI_BACKGROUND_COLORS = {
    blue: ['\x1b[44m', '\x1b[49m'],
    cyan: ['\x1b[46m', '\x1b[49m'],
    gray: ['\x1b[100m', '\x1b[49m'],
    green: ['\x1b[42m', '\x1b[49m'],
    magenta: ['\x1b[45m', '\x1b[49m'],
    red: ['\x1b[41m', '\x1b[49m'],
    yellow: ['\x1b[43m', '\x1b[49m'],
} as const;

type ConsoleColor = keyof typeof ANSI_COLORS;
type ConsoleBackgroundColor = keyof typeof ANSI_BACKGROUND_COLORS;

const HTTP_METHOD_COLORS: Record<string, ConsoleBackgroundColor> = {
    ALL: 'gray',
    GET: 'green',
    POST: 'cyan',
    PUT: 'yellow',
    PATCH: 'magenta',
    DELETE: 'red',
    OPTIONS: 'gray',
    HEAD: 'gray',
};

const CONTEXT_TAGS: Record<string, { label: string; color: ConsoleColor }> = {
    Bootstrap: { label: 'APP', color: 'cyan' },
    InstanceLoader: { label: 'NEST', color: 'gray' },
    NestApplication: { label: 'NEST', color: 'gray' },
    NestFactory: { label: 'NEST', color: 'gray' },
    RouterExplorer: { label: 'NEST', color: 'gray' },
    RoutesResolver: { label: 'NEST', color: 'gray' },
};

const CONTEXT_SUFFIX_TAGS: Array<{ suffix: string; label: string; color: ConsoleColor }> = [
    { suffix: 'Controller', label: 'CONTROLLER', color: 'blue' },
    { suffix: 'Service', label: 'SERVICE', color: 'green' },
    { suffix: 'Repository', label: 'REPOSITORY', color: 'cyan' },
    { suffix: 'Middleware', label: 'MIDDLEWARE', color: 'magenta' },
    { suffix: 'Interceptor', label: 'INTERCEPTOR', color: 'yellow' },
    { suffix: 'Guard', label: 'GUARD', color: 'yellow' },
    { suffix: 'Filter', label: 'FILTER', color: 'red' },
    { suffix: 'Gateway', label: 'GATEWAY', color: 'cyan' },
    { suffix: 'Strategy', label: 'STRATEGY', color: 'yellow' },
    { suffix: 'UseCase', label: 'USE_CASE', color: 'green' },
];

@Injectable()
export class SpacedConsoleLogger extends ConsoleLogger {
    private static hasPrintedMessage = false;
    private static previousSection = '';
    private static currentRouteSection = '';
    private static hasClearedAfterModules = false;
    private activeContext = '';

    protected formatContext(context: string): string {
        this.activeContext = context;

        if (!context) {
            return '';
        }

        const sourceTag = this.resolveSourceTag(context);
        const sourceMessage = sourceTag ? `${this.paint(`[${sourceTag.label}]`, sourceTag.color)} ` : '';

        return `${sourceMessage}${this.paint(`[${context}]`, 'yellow')} `;
    }

    protected formatMessage(logLevel: LogLevel, message: unknown, _pidMessage: string, _formattedLogLevel: string, _contextMessage: string, timestampDiff: string): string {
        const output = this.stringifyOutput(message, logLevel);
        const separator = this.resolveSeparator(message);
        SpacedConsoleLogger.hasPrintedMessage = true;

        if (this.isRequestLog(message)) {
            return `${separator}${this.getTimestamp()} | ${output}\n`;
        }

        return `${separator}${this.formatStandardLog(logLevel, message, output)}${timestampDiff}\n`;
    }

    protected printStackTrace(stack: string): void {
        if (!stack || this.options.json) {
            return;
        }

        const formattedStack = stack
            .split('\n')
            .map((line, index) => `${this.getTimestamp()} | ${this.paint(index === 0 ? '[STACK]' : '[TRACE]', 'red')} ${this.paint(line.trim(), 'gray')}`)
            .join('\n');

        if (this.options.forceConsole) {
            console.error(formattedStack);
            return;
        }

        process.stderr.write(`${formattedStack}\n`);
    }

    private stringifyOutput(message: unknown, logLevel: LogLevel): string {
        if (typeof message === 'string') {
            return this.formatStringMessage(message, logLevel);
        }

        return this.stringifyMessage(message, logLevel);
    }

    private formatStringMessage(message: string, logLevel: LogLevel): string {
        const formattedMessage = this.colorizeRequestDetails(message);

        return formattedMessage === message ? this.colorize(message, logLevel) : formattedMessage;
    }

    private colorizeRequestDetails(message: string): string {
        return message
            .replace(/\[(ALL|GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\]/g, (tag: string, method: string) => this.paintBadge(tag, HTTP_METHOD_COLORS[method] ?? 'gray'))
            .replace(/\bstatus=(\d{3})\b/g, (tag: string, status: string) => this.paint(tag, this.resolveStatusColor(Number(status))))
            .replace(/(^|\s)(\d{3})(?=\s)/g, (_tag: string, prefix: string, status: string) => `${prefix}${this.paint(status, this.resolveStatusColor(Number(status)))}`)
            .replace(/\bduration=\d+ms\b/g, (tag: string) => this.paint(tag, 'gray'))
            .replace(/\b\d+ms\b/g, (tag: string) => this.paint(tag, 'gray'))
            .replace(/\brequestId=\S+\b/g, (tag: string) => this.paint(tag, 'gray'))
            .replace(/\borigin=\S+/g, (tag: string) => this.paint(tag, 'cyan'))
            .replace(/\bhasCookie=(true|false)\b/g, (tag: string, value: string) => this.paint(tag, value === 'true' ? 'green' : 'red'))
            .replace(/\bquery=/g, (tag: string) => this.paint(tag, 'blue'))
            .replace(/\bbody=/g, (tag: string) => this.paint(tag, 'cyan'))
            .replace(/\bcookies=/g, (tag: string) => this.paint(tag, 'magenta'))
            .replace(/"\[redacted\]"/g, (tag: string) => this.paint(tag, 'yellow'));
    }

    private isRequestLog(message: unknown): boolean {
        return typeof message === 'string' && /^\[(ALL|GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\]\s/.test(message);
    }

    private formatStandardLog(logLevel: LogLevel, message: unknown, output: string): string {
        if (typeof message === 'string') {
            const routeLog = this.formatRouteLog(message);

            if (routeLog) {
                return routeLog;
            }

            const controllerLog = this.formatControllerLog(message);

            if (controllerLog) {
                return controllerLog;
            }

            const moduleLog = this.formatModuleLog(message);

            if (moduleLog) {
                return moduleLog;
            }
        }

        const levelMessage = logLevel === 'log' ? '' : `${this.paint(`[${logLevel.toUpperCase()}]`, this.resolveLevelColor(logLevel))} `;
        const sourceMessage = this.formatSourceMessage();

        return `${this.getTimestamp()} | ${levelMessage}${sourceMessage}${output}`;
    }

    private formatRouteLog(message: string): string | undefined {
        if (this.activeContext !== 'RouterExplorer') {
            return undefined;
        }

        const match = /^Mapped \{(.+), (ALL|GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\} route$/.exec(message);

        if (!match) {
            return undefined;
        }

        const [, path, method] = match;

        return `${this.getTimestamp()} | ${this.paint('[ROUTE]', 'blue')} ${this.paintBadge(`[${method}]`, HTTP_METHOD_COLORS[method] ?? 'gray')} ${path}`;
    }

    private formatControllerLog(message: string): string | undefined {
        if (this.activeContext !== 'RoutesResolver') {
            return undefined;
        }

        const match = /^(.+Controller) \{(.+)\}:$/.exec(message);

        if (!match) {
            return undefined;
        }

        const [, controller, path] = match;

        return `${this.getTimestamp()} | ${this.paint('[CONTROLLER]', 'blue')} ${this.paint(`[${controller}]`, 'yellow')} ${path}`;
    }

    private formatModuleLog(message: string): string | undefined {
        if (this.activeContext !== 'InstanceLoader') {
            return undefined;
        }

        const match = /^(.+Module) dependencies initialized$/.exec(message);

        if (!match) {
            return undefined;
        }

        const [, moduleName] = match;

        return `${this.getTimestamp()} | ${this.paint('[MODULE]', 'cyan')} ${moduleName} dependencies initialized`;
    }

    private formatSourceMessage(): string {
        const sourceTag = this.resolveSourceTag(this.activeContext);
        const sourceMessage = sourceTag ? `${this.paint(`[${sourceTag.label}]`, sourceTag.color)} ` : '';
        const contextMessage = this.activeContext ? `${this.paint(`[${this.activeContext}]`, 'yellow')} ` : '';

        return `${sourceMessage}${contextMessage}`;
    }

    private resolveSeparator(message: unknown): string {
        const section = this.resolveLogSection(message);
        const shouldSeparate = SpacedConsoleLogger.hasPrintedMessage && (section !== SpacedConsoleLogger.previousSection || section === 'requests');

        this.clearConsoleAfterModules(section);
        SpacedConsoleLogger.previousSection = section;

        return shouldSeparate ? '\n' : '';
    }

    private clearConsoleAfterModules(section: string): void {
        if (SpacedConsoleLogger.hasClearedAfterModules || SpacedConsoleLogger.previousSection !== 'modules' || section === 'modules' || !process.stdout.isTTY) {
            return;
        }

        SpacedConsoleLogger.hasClearedAfterModules = true;
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
    }

    private resolveLogSection(message: unknown): string {
        if (this.isRequestLog(message)) {
            return 'requests';
        }

        if (typeof message === 'string') {
            const controllerSection = this.resolveControllerSection(message);

            if (controllerSection) {
                SpacedConsoleLogger.currentRouteSection = controllerSection;
                return controllerSection;
            }

            if (this.isRouteMappingLog(message)) {
                return SpacedConsoleLogger.currentRouteSection || 'routes';
            }

            if (this.isModuleLog(message)) {
                return 'modules';
            }
        }

        const sourceTag = this.resolveSourceTag(this.activeContext);

        return sourceTag?.label ? sourceTag.label.toLowerCase() : this.activeContext || 'general';
    }

    private resolveControllerSection(message: string): string | undefined {
        if (this.activeContext !== 'RoutesResolver') {
            return undefined;
        }

        const match = /^(.+Controller) \{.+\}:$/.exec(message);

        return match ? `routes:${match[1]}` : undefined;
    }

    private isRouteMappingLog(message: string): boolean {
        return this.activeContext === 'RouterExplorer' && /^Mapped \{.+, (ALL|GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\} route$/.test(message);
    }

    private isModuleLog(message: string): boolean {
        return this.activeContext === 'InstanceLoader' && /^.+Module dependencies initialized$/.test(message);
    }

    private resolveLevelColor(logLevel: LogLevel): ConsoleColor {
        if (logLevel === 'error' || logLevel === 'fatal') {
            return 'red';
        }

        if (logLevel === 'warn') {
            return 'yellow';
        }

        if (logLevel === 'debug') {
            return 'magenta';
        }

        if (logLevel === 'verbose') {
            return 'cyan';
        }

        return 'green';
    }

    private resolveSourceTag(context: string): { label: string; color: ConsoleColor } | undefined {
        return CONTEXT_TAGS[context] ?? CONTEXT_SUFFIX_TAGS.find((tag) => context.endsWith(tag.suffix));
    }

    private resolveStatusColor(statusCode: number): ConsoleColor {
        if (statusCode >= 500) {
            return 'red';
        }

        if (statusCode >= 400) {
            return 'yellow';
        }

        if (statusCode >= 300) {
            return 'cyan';
        }

        if (statusCode >= 200) {
            return 'green';
        }

        return 'gray';
    }

    private paint(message: string, color: ConsoleColor): string {
        if (!this.options.colors) {
            return message;
        }

        const [open, close] = ANSI_COLORS[color];

        return `${open}${message}${close}`;
    }

    private paintBadge(message: string, backgroundColor: ConsoleBackgroundColor): string {
        if (!this.options.colors) {
            return message;
        }

        const textColor = backgroundColor === 'yellow' || backgroundColor === 'green' || backgroundColor === 'cyan' ? 'black' : 'white';
        const [openText, closeText] = ANSI_COLORS[textColor];
        const [openBackground, closeBackground] = ANSI_BACKGROUND_COLORS[backgroundColor];

        return `${openBackground}${openText}${message}${closeText}${closeBackground}`;
    }
}
