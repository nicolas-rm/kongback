import { ValidatorString } from '@/decorators';

export class UpdateDocumentDto {
    @ValidatorString({ optional: true })
    title?: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    category?: string | null;
}
