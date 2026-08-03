import { Injectable } from '@nestjs/common';

type SimpleEmailTemplateInput = {
    appName: string;
    title: string;
    body: string;
    actionLabel?: string;
    actionUrl?: string;
    details?: EmailDetail[];
    detailsTitle?: string;
    securityNote?: string;
    copyLinkText?: string;
    securityTitle?: string;
    footerText?: string;
};

type EmailDetail = {
    label: string;
    value: string;
    monospace?: boolean;
};

@Injectable()
export class EmailTemplateService {
    buildSimpleEmail(input: SimpleEmailTemplateInput): string {
        const preheader = this.escapeHtml(input.body);
        const action =
            input.actionLabel && input.actionUrl
                ? `
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0">
                                    <tr>
                                        <td bgcolor="#111827" style="border-radius:8px">
                                            <a href="${this.escapeHtml(input.actionUrl)}" style="display:inline-block;padding:13px 20px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">${this.escapeHtml(input.actionLabel)}</a>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#6b7280">${this.escapeHtml(input.copyLinkText ?? 'Si el boton no funciona, copia y pega este enlace en tu navegador:')}<br><a href="${this.escapeHtml(input.actionUrl)}" style="color:#111827;text-decoration:underline;word-break:break-all">${this.escapeHtml(input.actionUrl)}</a></p>`
                : '';
        const details = input.details?.length ? this.buildDetails(input.details, input.detailsTitle) : '';
        const securityNote = input.securityNote ? this.buildSecurityNote(input.securityNote, input.securityTitle ?? 'Aviso de seguridad') : '';
        const footerText = input.footerText ?? `Este correo fue enviado automaticamente por ${input.appName}. No respondas a este mensaje.`;

        return `<!doctype html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${this.escapeHtml(input.title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#111827">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6f8">
            <tr>
                <td align="center" style="padding:36px 12px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
                        <tr>
                            <td bgcolor="#41d37e" style="height:6px;font-size:0;line-height:0">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="padding:30px 34px 8px;background:#ffffff">
                                <p style="margin:0 0 26px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;font-weight:800;color:#111827">${this.escapeHtml(input.appName)}</p>
                                <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:34px;font-weight:700;color:#111827">${this.escapeHtml(input.title)}</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:18px 34px 34px;background:#ffffff">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 2px">
                                    <tr>
                                        <td style="padding:0 0 0 14px;border-left:3px solid #41d37e">
                                            <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:#374151">${this.escapeHtml(input.body)}</p>
                                        </td>
                                    </tr>
                                </table>
                                ${details}
                                ${action}
                                ${securityNote}
                            </td>
                        </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
                        <tr>
                            <td style="padding:18px 8px 0;text-align:center">
                                <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#8a93a3">${this.escapeHtml(footerText)}</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>`;
    }

    private buildDetails(details: EmailDetail[], title?: string): string {
        const heading = title
            ? `
                                    <tr>
                                        <td style="padding:18px 18px 4px">
                                            <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:18px;font-weight:800;color:#111827">${this.escapeHtml(title)}</p>
                                        </td>
                                    </tr>`
            : '';
        const rows = details
            .map((detail, index) => {
                const border = index === details.length - 1 ? '' : 'border-bottom:1px solid #e5e7eb;';
                const valueStyle = detail.monospace ? 'font-family:Consolas,Monaco,monospace;font-size:20px;letter-spacing:.5px' : 'font-family:Arial,sans-serif;font-size:18px';

                return `
                                    <tr>
                                        <td style="padding:${index === 0 && title ? '12px' : '15px'} 18px;${border}">
                                            <p style="margin:0 0 7px;font-family:Arial,sans-serif;font-size:12px;line-height:16px;font-weight:700;color:#6b7280;text-transform:uppercase">${this.escapeHtml(detail.label)}</p>
                                            <p style="margin:0;${valueStyle};line-height:26px;font-weight:700;color:#111827;word-break:break-word">${this.escapeHtml(detail.value)}</p>
                                        </td>
                                    </tr>`;
            })
            .join('');

        return `
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate">
                                    ${heading}
                                    ${rows}
                                </table>`;
    }

    private buildSecurityNote(note: string, title: string): string {
        return `
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;border:1px solid #e5e7eb;border-radius:10px;background:#ffffff">
                                    <tr>
                                        <td style="padding:16px 18px;border-left:3px solid #41d37e">
                                            <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;line-height:18px;font-weight:700;color:#111827">${this.escapeHtml(title)}</p>
                                            <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#4b5563">${this.escapeHtml(note)}</p>
                                        </td>
                                    </tr>
                                </table>`;
    }

    private escapeHtml(value: string): string {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
}
