import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { bearer } from 'better-auth/plugins';
import { Resend } from 'resend';
import { db } from './db';
import { frontendUrl, requiredEnv, trustedOrigins } from './config';

const resend = new Resend(requiredEnv('RESEND_API_KEY'));
const sender = requiredEnv('RESEND_FROM_EMAIL');
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

async function sendAccountEmail(to: string, subject: string, url: string) {
    const { error } = await resend.emails.send({ from: sender, to, subject, text: `${subject}\n\n${url}\n\nIf you did not request this, you can ignore this email.` });
    if (error) throw new Error(`Email delivery failed: ${error.message}`);
}

export const auth = betterAuth({
    database: db,
    secret: requiredEnv('BETTER_AUTH_SECRET'),
    // Public frontend URL: auth requests reach this backend through the Next proxy.
    baseURL: process.env.BETTER_AUTH_URL || frontendUrl,
    trustedOrigins,
    plugins: [bearer()],
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: true,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => sendAccountEmail(user.email, 'Reset your Trivia World password', url),
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => sendAccountEmail(user.email, 'Verify your Trivia World email', url),
    },
    socialProviders: googleEnabled ? {
        google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    } : {},
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            if (ctx.path === '/sign-up/email' || ctx.path === '/update-user') {
                if (ctx.body?.name !== undefined) {
                    const name = typeof ctx.body.name === 'string' ? ctx.body.name.trim() : '';
                    if (name.length < 3 || name.length > 15) throw new APIError('BAD_REQUEST', { message: 'Username must be 3–15 characters.' });
                    ctx.body.name = name;
                }
                // Avatar URLs are set only after a validated server-side upload.
                if (ctx.body?.image !== undefined) throw new APIError('BAD_REQUEST', { message: 'Use the avatar upload to change your picture.' });
            }
        }),
    },
    rateLimit: { enabled: true, storage: 'database' },
});

export { googleEnabled };
