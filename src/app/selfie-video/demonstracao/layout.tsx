import type { Metadata } from 'next';

const TITLE = 'Grave seu depoimento | Votia';
const DESCRIPTION =
  'Grave um vídeo curto e receba uma resposta personalizada em vídeo no seu WhatsApp.';

// Override COMPLETO da metadata do layout raiz (que é do PL) — a demo é
// white label: título absoluto (fora do template "| PL") + OG/Twitter próprios.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Votia',
    images: [{ url: '/logo-votia.png', width: 1254, height: 1254 }],
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/logo-votia.png'],
  },
};

export default function DemonstracaoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
