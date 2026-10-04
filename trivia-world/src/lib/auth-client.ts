'use client';

import { createAuthClient } from 'better-auth/react';

// Same-origin requests are proxied to Render; session cookies stay first-party.
export const authClient = createAuthClient();

