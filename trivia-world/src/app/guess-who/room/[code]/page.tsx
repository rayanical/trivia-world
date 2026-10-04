import GuessRoom from '../../GuessRoom';
export default async function JoinGuessGame({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params; return <GuessRoom code={code.toUpperCase()} />;
}
