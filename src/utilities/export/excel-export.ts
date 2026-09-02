import ExcelJS from 'exceljs';

export const EXCEL_EXPORT_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const EXCEL_EXPORT_MAX_ROWS = 5000;
export const EXPORT_FORMAT_VALUES = ['xlsx', 'excel', 'csv', 'txt', 'pdf'] as const;

export type ExportFormatInput = (typeof EXPORT_FORMAT_VALUES)[number];
export type ExportFormat = 'xlsx' | 'csv' | 'txt' | 'pdf';

export type ExcelExportCellValue = string | number | boolean | Date | null | undefined;

export type ExcelExportColumn<T> = {
    header: string;
    value: (row: T) => ExcelExportCellValue;
};

export type ExcelExportFile = {
    filename: string;
    mimeType: string;
    buffer: Buffer;
};

type HeaderWritable = {
    setHeader(name: string, value: string): unknown;
};

export async function createExcelExport<T>(filename: string, sheetName: string, columns: ExcelExportColumn<T>[], rows: T[], formatInput?: ExportFormatInput): Promise<ExcelExportFile> {
    const format = normalizeExportFormat(formatInput);
    const outputFilename = filenameForFormat(filename, format);

    if (format === 'csv') {
        return {
            filename: outputFilename,
            mimeType: 'text/csv; charset=utf-8',
            buffer: Buffer.from(`\uFEFF${buildDelimitedText(columns, rows, ',')}`, 'utf8'),
        };
    }

    if (format === 'txt') {
        return {
            filename: outputFilename,
            mimeType: 'text/plain; charset=utf-8',
            buffer: Buffer.from(buildDelimitedText(columns, rows, '\t'), 'utf8'),
        };
    }

    if (format === 'pdf') {
        return {
            filename: outputFilename,
            mimeType: 'application/pdf',
            buffer: buildPdf(sheetName, columns, rows),
        };
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kong Back';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.addRow(columns.map((column) => column.header));
    for (const row of rows) {
        worksheet.addRow(columns.map((column) => normalizeCellValue(column.value(row))));
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
    };

    autosizeWorksheet(worksheet, columns.length);

    return {
        filename: outputFilename,
        mimeType: EXCEL_EXPORT_MIME_TYPE,
        buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
}

export function setExcelAttachmentHeaders(response: HeaderWritable, file: ExcelExportFile): void {
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', buildAttachmentDisposition(file.filename));
    response.setHeader('Content-Length', String(file.buffer.length));
}

export function buildAttachmentDisposition(filename: string): string {
    const fallback = filename.replace(/["\\\r\n]/g, '_');
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function valueOrDash(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

export function joinValues(values: Array<string | null | undefined>): string {
    const clean = values.filter((value): value is string => Boolean(value));
    return clean.length ? clean.join(', ') : '-';
}

export function formatBoolean(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return value ? 'Si' : 'No';
}

export function formatStatus(status: string | null | undefined): string {
    if (status === 'active') return 'Activo';
    if (status === 'inactive') return 'Inactivo';
    if (status === 'suspended') return 'Suspendido';
    return valueOrDash(status);
}

export function sanitizeFilenamePart(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

function normalizeCellValue(value: ExcelExportCellValue): ExcelJS.CellValue {
    if (value === null || value === undefined || value === '') return '-';
    return value;
}

function normalizeExportFormat(format?: ExportFormatInput): ExportFormat {
    if (format === 'csv' || format === 'txt' || format === 'pdf') return format;
    return 'xlsx';
}

function filenameForFormat(filename: string, format: ExportFormat): string {
    const base = filename.replace(/\.(xlsx|csv|txt|pdf)$/i, '');
    return `${base}.${format}`;
}

function buildDelimitedText<T>(columns: ExcelExportColumn<T>[], rows: T[], delimiter: ',' | '\t'): string {
    const lines = [
        columns.map((column) => escapeDelimitedValue(column.header, delimiter)).join(delimiter),
        ...rows.map((row) => columns.map((column) => escapeDelimitedValue(valueOrDash(column.value(row)), delimiter)).join(delimiter)),
    ];
    return `${lines.join('\n')}\n`;
}

function escapeDelimitedValue(value: string, delimiter: ',' | '\t'): string {
    if (delimiter === '\t') return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    const escaped = value.replace(/"/g, '""');
    return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function buildPdf<T>(title: string, columns: ExcelExportColumn<T>[], rows: T[]): Buffer {
    const lines = buildPdfLines(title, columns, rows);
    const pages: string[] = [];
    const pageLineCount = 48;

    for (let index = 0; index < lines.length; index += pageLineCount) {
        pages.push(buildPdfPageContent(lines.slice(index, index + pageLineCount)));
    }

    return buildPdfDocument(pages.length ? pages : [buildPdfPageContent([title])]);
}

function buildPdfLines<T>(title: string, columns: ExcelExportColumn<T>[], rows: T[]): string[] {
    const columnWidth = Math.max(10, Math.floor(150 / Math.max(columns.length, 1)));
    const header = columns.map((column) => truncatePdfColumn(column.header, columnWidth)).join(' | ');
    const divider = '-'.repeat(Math.min(header.length, 180));
    return [
        title,
        `Generado: ${new Date().toISOString()}`,
        `Registros: ${rows.length}`,
        '',
        header,
        divider,
        ...rows.map((row) => columns.map((column) => truncatePdfColumn(valueOrDash(column.value(row)), columnWidth)).join(' | ')),
    ];
}

function truncatePdfColumn(value: string, width: number): string {
    const clean = toPdfText(value).replace(/\s+/g, ' ').trim();
    if (clean.length <= width) return clean.padEnd(width, ' ');
    if (width <= 3) return clean.slice(0, width);
    return `${clean.slice(0, width - 3)}...`;
}

function buildPdfPageContent(lines: string[]): string {
    const commands = ['BT', '/F1 7 Tf', '30 565 Td'];
    lines.forEach((line, index) => {
        if (index > 0) commands.push('0 -11 Td');
        commands.push(`(${escapePdfString(line)}) Tj`);
    });
    commands.push('ET');
    return commands.join('\n');
}

function buildPdfDocument(pageContents: string[]): Buffer {
    const objects: string[] = [];
    const pageObjectIds: number[] = [];

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    pageContents.forEach((content, index) => {
        const pageObjectId = 4 + index * 2;
        const contentObjectId = pageObjectId + 1;
        pageObjectIds.push(pageObjectId);
        objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
        objects[contentObjectId] = `<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream`;
    });

    objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let id = 1; id < objects.length; id++) {
        offsets[id] = Buffer.byteLength(pdf, 'binary');
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'binary');
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';
    for (let id = 1; id < objects.length; id++) {
        pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'binary');
}

function escapePdfString(value: string): string {
    return toPdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toPdfText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, '?');
}

function autosizeWorksheet(worksheet: ExcelJS.Worksheet, columnCount: number): void {
    for (let index = 1; index <= columnCount; index++) {
        const column = worksheet.getColumn(index);
        let width = 14;
        column.eachCell({ includeEmpty: true }, (cell) => {
            width = Math.max(width, cellValueToText(cell.value).length + 2);
        });
        column.width = Math.min(width, 72);
    }
}

function cellValueToText(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text.trim();
    return String(value);
}
