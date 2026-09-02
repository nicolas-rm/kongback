import { EXPORT_FORMAT_VALUES, type ExportFormatInput } from '@/utilities/export/excel-export';
import { ValidatorEnum } from '@/decorators';

export class ExportQueryDto {
    @ValidatorEnum(EXPORT_FORMAT_VALUES, { optional: true, toLowerCase: true })
    format?: ExportFormatInput;
}
