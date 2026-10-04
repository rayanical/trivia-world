export function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const frontendOrigins = requiredEnv('FRONTEND_URL').split(',').map((value) => new URL(value.trim()).origin);
export const frontendUrl = frontendOrigins[0];
export const trustedOrigins = [...frontendOrigins, ...(process.env.AUTH_TRUSTED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)];
