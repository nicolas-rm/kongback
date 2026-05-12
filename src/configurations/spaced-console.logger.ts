import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class SpacedConsoleLogger extends ConsoleLogger {
    protected formatMessage(logLevel: string, message: unknown, pidMessage: string, formattedLogLevel: string, contextMessage: string, timestampDiff: string) {
        return `${pidMessage}${this.getTimestamp()} ${formattedLogLevel} ${contextMessage}${String(message)}${timestampDiff}\n`;
    }
}
