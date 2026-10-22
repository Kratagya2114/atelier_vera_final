import type { ReactNode } from 'react';

export const metadata = {
  title: 'Atelier Vera',
  description: 'Bespoke residential, boutique hospitality & collectible spatial design.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
