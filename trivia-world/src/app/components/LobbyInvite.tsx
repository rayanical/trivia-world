'use client';
import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
const QrCode = dynamic(() => import('./LobbyQrCode'), { ssr: false, loading: () => <div className="h-60 flex items-center justify-center text-sm text-white/60">Preparing QR code…</div> });
const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const serverOrigin = () => '';
export default function LobbyInvite({ gameCode, disabled = false }: { gameCode: string; disabled?: boolean }) {
    const origin = useSyncExternalStore(subscribe, getOrigin, serverOrigin);
    const url = gameCode && origin ? `${origin}/lobby/${gameCode}` : '';
    const [showQr, setShowQr] = useState(false);
    const [message, setMessage] = useState('');
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); setMessage('Invite link copied.'); }
        catch { setMessage('Select the link above and copy it to invite friends.'); }
    };
    return <section className="rounded-xl p-4 border border-white/10 bg-white/5">
        <h2 className="font-bold mb-3">Invite friends</h2>
        <label className="sr-only" htmlFor="invite-link">Invite link</label>
        <input id="invite-link" readOnly value={url} onFocus={event => event.target.select()} placeholder="Your invite link will appear here" className="w-full rounded-md bg-black/20 p-2 text-sm min-w-0 text-white/80" />
        <div className="flex gap-2 mt-3">
            <button onClick={() => void copy()} disabled={!url || disabled} className="flex-1 h-11 rounded-md bg-green-800 hover:bg-green-900 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Copy Link</button>
            <button onClick={() => setShowQr(value => !value)} disabled={!url || disabled} aria-expanded={showQr} aria-controls="lobby-qr" className="flex-1 h-11 rounded-md bg-white/10 hover:bg-white/20 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{showQr ? 'Hide QR' : 'Show QR'}</button>
        </div>
        <p className="min-h-6 mt-2 text-xs text-green-300" role="status">{message}</p>
        {showQr && url && !disabled && <div id="lobby-qr"><QrCode url={url} /></div>}
    </section>;
}
