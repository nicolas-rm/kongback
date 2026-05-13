export const argon2id = 2;

export function hash(password: string): Promise<string> {
    return Promise.resolve(`argon2:${password}`);
}

export function verify(hashValue: string, password: string): Promise<boolean> {
    return Promise.resolve(hashValue === `argon2:${password}`);
}
