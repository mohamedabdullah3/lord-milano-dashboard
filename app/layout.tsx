import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lord Milano — Performance Hub',
  description: 'لوحة تحكم أداء الإعلانات — Snapchat, Meta, TikTok, Google Ads',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="ltr" className={`${geist.variable} dark`}>
      <body className="min-h-screen bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
