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
  icons: { icon: '/icons/192', apple: '/icons/apple' },
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
