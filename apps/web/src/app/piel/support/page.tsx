import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with Piel — contact, FAQ, account deletion, bug reports, and feature requests.',
  alternates: { canonical: 'https://motovault.app/piel/support' },
};

const ink2 = '#6B635B';
const accent = '#B08968';
const line = 'rgba(43, 39, 36, 0.1)';

const FAQ = [
  {
    q: 'What is Piel?',
    a: 'Piel reads a product’s ingredient list and gives it a Halo — a clear verdict on whether it suits your skin. It also checks your whole routine together, flags timing conflicts, and keeps track of what’s on your shelf.',
  },
  {
    q: 'What is a Halo verdict?',
    a: 'A Halo is Piel’s personalized read on a product or routine: good match, patch test first, or steer clear. It’s based on your skin profile, not a generic star rating, and updates as your profile changes.',
  },
  {
    q: 'How do I delete my account and data?',
    a: 'Open the app and go to Profile → Delete account. This permanently removes your profile, shelf, routine, and check-ins. You can also email us and we’ll do it for you.',
  },
  {
    q: 'How is my data handled?',
    a: 'We collect only what’s needed to run your account and the content you create. We don’t use your data for advertising or cross-app tracking, and we don’t sell it. See the Privacy Policy for full detail.',
  },
  {
    q: 'Does Piel give medical advice?',
    a: 'No. Piel is an informational tool. For skin conditions or reactions, please consult a qualified professional.',
  },
  {
    q: 'Which sign-in options are supported?',
    a: 'Sign in with Apple, Google, email and password, or continue as a guest. Guest accounts can be linked to Apple, Google, or email later so your data carries over.',
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>
        {title}
      </h2>
      <div style={{ fontSize: 16, lineHeight: 1.7, color: '#3D3833' }}>{children}</div>
    </section>
  );
}

export default function PielSupportPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
      />
      <article>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>Support</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, marginTop: 8, color: ink2 }}>
          Questions, bugs, or feedback about Piel? We’re happy to help.
        </p>

        <Section title="Contact us">
          <ul style={{ paddingLeft: 22 }}>
            <li>
              <strong>Email:</strong>{' '}
              <a href="mailto:support@motovault.app" style={{ color: accent }}>
                support@motovault.app
              </a>
            </li>
            <li>
              <strong>Response time:</strong> we aim to reply within 2 business days.
            </li>
          </ul>
        </Section>

        <Section title="Frequently asked questions">
          {FAQ.map(({ q, a }) => (
            <details key={q} style={{ borderBottom: `1px solid ${line}`, padding: '14px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>{q}</summary>
              <p style={{ marginTop: 8, color: ink2 }}>{a}</p>
            </details>
          ))}
        </Section>

        <Section title="Report a bug">
          <p>
            Found something broken? Email{' '}
            <a href="mailto:support@motovault.app" style={{ color: accent }}>
              support@motovault.app
            </a>{' '}
            with your device model, iOS version, and a short description of what happened.
            Screenshots help a lot.
          </p>
        </Section>

        <Section title="Request a feature">
          <p>
            We build Piel around what people actually need. Tell us what would make your routine
            easier at the email above — we read every message.
          </p>
        </Section>
      </article>
    </>
  );
}
