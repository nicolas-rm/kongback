import { Injectable } from '@nestjs/common';

type SimpleEmailTemplateInput = {
    appName: string;
    title: string;
    body: string;
    actionLabel?: string;
    actionUrl?: string;
};

@Injectable()
export class EmailTemplateService {
    buildSimpleEmail(input: SimpleEmailTemplateInput): string {
        const action =
            input.actionLabel && input.actionUrl
                ? `<p><a href="${this.escapeHtml(input.actionUrl)}" style="display:inline-block;background:#111827;color:white;padding:10px 14px;border-radius:6px;text-decoration:none">${this.escapeHtml(input.actionLabel)}</a></p>`
                : '';

        return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111827"><h1>${this.escapeHtml(input.title)}</h1><p>${this.escapeHtml(input.body)}</p>${action}<p style="color:#6b7280;font-size:12px">${this.escapeHtml(input.appName)}</p></body></html>`;
    }

    private escapeHtml(value: string): string {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
}
