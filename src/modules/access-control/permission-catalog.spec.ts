import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_PERMISSION_CODES } from '../../../prisma/permission-catalog';

describe('permission catalog', () => {
    it('contains every permission used by controllers', () => {
        const sourceDir = join(process.cwd(), 'src');
        const files = [
            'modules/access-control/permissions.controller.ts',
            'modules/access-control/roles.controller.ts',
            'modules/documents/documents.controller.ts',
            'modules/notifications/notifications.controller.ts',
            'modules/users/users.controller.ts',
        ];
        const usedPermissions = new Set<string>();

        for (const file of files) {
            const content = readFileSync(join(sourceDir, file), 'utf8');
            for (const match of content.matchAll(/@Permissions\(([^)]*)\)/g)) {
                const values = match[1].match(/'([^']+)'/g) ?? [];
                values.map((value) => value.replace(/'/g, '')).forEach((value) => usedPermissions.add(value));
            }
        }

        const missing = [...usedPermissions].filter((permission) => !ALL_PERMISSION_CODES.includes(permission as never));
        expect(missing).toEqual([]);
    });
});
