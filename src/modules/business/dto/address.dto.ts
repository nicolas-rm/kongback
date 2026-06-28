import { ValidatorString } from '@/decorators';

export class AddressDto {
    @ValidatorString({ optional: true, emptyTo: 'null' })
    street?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    exteriorNumber?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    interiorNumber?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    neighborhood?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    municipality?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    city?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    state?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    country?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    postalCode?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    references?: string | null;
}
