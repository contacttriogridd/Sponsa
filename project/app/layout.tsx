import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VP Trust | Compassionate Sponsorship Management',
  description: 'Manage sponsors, special occasions, food sponsorships, and donations with clarity.',
  themeColor: '#8173C9',
  appleWebApp: { capable: true, title: 'VP Trust', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/brand/favicon-48.png', sizes: '48x48' }, { url: '/brand/icon-192.png', sizes: '192x192' }],
    apple: '/brand/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
