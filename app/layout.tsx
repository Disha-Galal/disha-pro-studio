import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ParseFlow | استوديو النصوص والملفات من Disha Pro Studio',
  description:
    'ParseFlow — اقرأ، نظّف، حرّر وحوّل مستنداتك محليًا داخل متصفحك. Read, clean, edit and convert your documents locally in your browser.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
