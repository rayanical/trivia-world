import GuessRoom from '../GuessRoom';
export default async function CreateGuessGame({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
    const { room } = await searchParams;
    const code = room && /^[A-Z0-9]{5}$/.test(room) ? room : undefined;
    return <GuessRoom create code={code} />;
}
