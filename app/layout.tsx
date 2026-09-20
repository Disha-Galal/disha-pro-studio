import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ParseFlow | Process thousands of rows in seconds',
  description: 'ParseFlow by Disha Pro Studio — turn PDF, DOCX and TXT files into clean, structured output in your browser.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'ParseFlow | Process thousands of rows in seconds',
    description: 'ParseFlow by Disha Pro Studio — turn PDF, DOCX and TXT files into clean, structured output in your browser.',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'ParseFlow' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
