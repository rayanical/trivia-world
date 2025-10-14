import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { gameCode: string } }): Promise<Metadata> {
    const gameCode = params.gameCode;
    const title = `Join my Trivia World game!`;
    const description = `Click the link to join the lobby. Game Code: ${gameCode}`;
    const imageUrl = 'https://triviaworld.live/og-lobby-image.png';

    return {
        title: `Join Trivia World Game: ${gameCode}`,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            url: `https://triviaworld.live/lobby/${gameCode}`,
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: 'Trivia World Lobby',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
    };
}

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
