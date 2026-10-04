import { io } from 'socket.io-client';

const URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(URL, { autoConnect: false });

export function guestId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const existing = sessionStorage.getItem('guestId');
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem('guestId', id);
    return id;
}
