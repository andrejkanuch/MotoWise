import { CtaSection } from '@/components/marketing/cta-section';
import { Faq } from '@/components/marketing/faq';
import { FAQ_DATA } from '@/components/marketing/faq-data';
import { FeaturesGrid } from '@/components/marketing/features-grid';
import { Hero } from '@/components/marketing/hero';

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MotoWise',
  url: 'https://motowise.app',
  logo: 'https://motowise.app/icon.png',
  description: 'AI-powered motorcycle learning & diagnostics platform',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_DATA.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={faqSchema} />
      <Hero />
      <FeaturesGrid />
      <CtaSection />
      <Faq />
    </>
  );
}
