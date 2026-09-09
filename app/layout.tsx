import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Atlas Cultural — Museos del Ecuador',
  description: 'Una exploración tridimensional e interactiva del territorio y los museos del Ecuador.',
  metadataBase: new URL('https://atlas-cultural-ecuador-3d.rjosp3.chatgpt.site'),
  openGraph: {
    title: 'Atlas Cultural — Museos del Ecuador',
    description: 'Explora los museos del Ecuador en una experiencia territorial 3D.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atlas Cultural — Museos del Ecuador',
    description: 'Explora los museos del Ecuador en una experiencia territorial 3D.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
