'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
export default function LobbyQrCode({ url }: { url: string }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        if (canvas.current) void QRCode.toCanvas(canvas.current, url, { width: 192, margin: 4, errorCorrectionLevel: 'M' }).catch(() => { if (active) setError(true); });
        return () => { active = false; };
    }, [url]);
    return <div className="flex flex-col items-center gap-2 py-3">
        <canvas ref={canvas} width={192} height={192} role="img" aria-label="Scan this QR code to join the lobby" className="w-48 h-48 rounded-md bg-white" />
        <p className="text-sm text-white/70">{error ? 'QR code unavailable. Use the invite link instead.' : 'Scan to join this lobby.'}</p>
    </div>;
}
