/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from 'next';
import { Space_Grotesk, Noto_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AlertProvider } from '@/context/AlertContext';
import Alert from './components/Alert';
import { Analytics } from '@vercel/analytics/next';
import Footer from './components/Footer';

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
    openGraph: {
        title: 'Trivia World',
        description: 'Challenge your friends in real-time trivia!',
        type: 'website',
        url: 'https://triviaworld.live',
        images: [
            {
                url: 'https://triviaworld.live/og-image.png',
                width: 1200,
                height: 630,
                alt: 'Trivia World Logo',
            },
        ],
    },
};

/**
 * Provides the global HTML structure, fonts, and shared context providers for the app.
 * @param children - React subtree for the current route segment.
 * @returns The HTML document skeleton with wrapped providers.
 */
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                {/* For Google Icons used in mockups */}
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=switch" rel="stylesheet" />
            </head>
            <body className={`${spaceGrotesk.variable} ${notoSans.variable} font-sans bg-background text-text-primary flex flex-col min-h-full`}>
                <AlertProvider>
                    <AuthProvider>
                        <main className="flex-auto">{children}</main>
                        <Analytics />
                        <Alert />
                        <Footer />
                    </AuthProvider>
                </AlertProvider>
            </body>
        </html>
    );
}
