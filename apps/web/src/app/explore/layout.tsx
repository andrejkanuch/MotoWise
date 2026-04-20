import { Instrument_Serif } from 'next/font/google';
import { PublicNavbar } from '@/components/public-navbar';
import '@/components/marketing/design-system.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mv-marketing ${instrumentSerif.variable}`}>
      <PublicNavbar />
      {children}
    </div>
  );
}
