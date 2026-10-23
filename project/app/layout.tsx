import './globals.css';
import type { Metadata } from 'next';
import { Inter, Noto_Sans_Tamil } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Fallback for Tamil text (e.g. the organization's Tamil name). Self-hosted by
// next/font, and only downloaded when Tamil characters appear on the page.
const notoSansTamil = Noto_Sans_Tamil({ subsets: ['tamil'], variable: '--font-tamil', preload: false });

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
    <html lang="en" className={`${inter.variable} ${notoSansTamil.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
