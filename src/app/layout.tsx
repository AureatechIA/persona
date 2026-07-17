import type { Metadata } from "next";
import { Manrope, Raleway } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://synthetic-person.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PL - Partido Liberal',
    template: '%s | PL - Partido Liberal',
  },
  description: 'Grave seu depoimento e receba uma resposta personalizada do PL - Partido Liberal.',
  // Ícones via config (não por convenção de arquivo em src/app) para que rotas
  // white-label possam substituir o campo `icons` inteiro no próprio layout.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  openGraph: {
    title: 'PL - Partido Liberal',
    description: 'Grave seu depoimento e receba uma resposta personalizada do PL - Partido Liberal.',
    url: SITE_URL,
    siteName: 'PL - Partido Liberal',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PL - Partido Liberal',
    description: 'Grave seu depoimento e receba uma resposta personalizada do PL - Partido Liberal.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body
        className={`${manrope.variable} ${raleway.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

