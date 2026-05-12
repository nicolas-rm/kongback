export const argon2id = 2;

export function hash(value: string): Promise<string> {
    return Promise.resolve(`hashed:${value}`);
}

export function verify(hashValue: string, value: string): Promise<boolean> {
    return Promise.resolve(hashValue === `hashed:${value}`);
}
