import type { Metadata } from 'next';
import { Space_Grotesk, Noto_Sans } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-space-grotesk',
});

const notoSans = Noto_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '700', '900'],
    variable: '--font-noto-sans',
});

export const metadata: Metadata = {
    title: 'Trivia World',
    description: 'Challenge your friends in real-time trivia!',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                {/* For Google Icons used in mockups */}
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
            </head>
            <body className={`${spaceGrotesk.variable} ${notoSans.variable} font-sans bg-background text-text-primary`}>{children}</body>
        </html>
    );
}
