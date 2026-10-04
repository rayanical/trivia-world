'use client';
import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { GuessButton, inputClass, panelClass } from './ui';
const QrCode = dynamic(() => import('../components/LobbyQrCode'), { ssr: false, loading: () => <p className="min-h-60 pt-4 text-sm">Preparing QR code…</p> });
const subscribe = () => () => {};
const origin = () => window.location.origin;
const serverOrigin = () => '';
export default function GuessInvite({ code }: { code: string }) {
    const base = useSyncExternalStore(subscribe, origin, serverOrigin);
    const url = code && base ? `${base}/guess-who/room/${code}` : '';
    const [qr, setQr] = useState(false); const [message, setMessage] = useState('');
    const copy = async () => { try { await navigator.clipboard.writeText(url); setMessage('Invite link copied.'); } catch { setMessage('Select the link above and copy it.'); } };
    return <div className={panelClass}><h2 className="mb-3 font-bold">Invite a friend</h2><label htmlFor="guess-invite" className="sr-only">Invite link</label><input id="guess-invite" value={url} readOnly onFocus={event => event.target.select()} placeholder="Your invite link will appear here" className={`${inputClass} text-xs`} /><div className="mt-3 flex gap-2"><GuessButton disabled={!url} onClick={() => void copy()} className="flex-1 px-2 text-sm">Copy Link</GuessButton><GuessButton disabled={!url} secondary aria-expanded={qr} aria-controls="guess-qr" onClick={() => setQr(value => !value)} className="flex-1 px-2 text-sm">{qr ? 'Hide QR' : 'Show QR'}</GuessButton></div><p role="status" className="mt-2 min-h-6 text-xs text-blue-200">{message}</p>{qr && url && <div id="guess-qr"><QrCode url={url} /></div>}</div>;
}
