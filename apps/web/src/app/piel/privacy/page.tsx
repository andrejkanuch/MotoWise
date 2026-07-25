import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Piel collects, uses, and protects your information. Piel is an informational skincare tool and does not provide medical advice.',
  alternates: { canonical: 'https://motovault.app/piel/privacy' },
};

const LAST_UPDATED = '25 July 2026';

const ink2 = '#6B635B';
const accent = '#B08968';

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

export default function PielPrivacyPage() {
  return (
    <article>
      <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
      <p style={{ color: ink2, marginTop: 8 }}>Last updated: {LAST_UPDATED}</p>

      <p style={{ fontSize: 16, lineHeight: 1.7, marginTop: 24, color: '#3D3833' }}>
        This policy explains what Piel (&ldquo;we&rdquo;, &ldquo;the app&rdquo;) collects, why, and
        your choices. Piel is a skincare companion that helps you check products against your skin
        profile and organize your routine.{' '}
        <strong>Piel is an informational tool and does not provide medical advice.</strong>
      </p>

      <Section title="Information we collect">
        <p>
          <strong>Account information.</strong> Piel offers several ways to sign in, and what we
          receive depends on the one you choose:
        </p>
        <ul style={{ paddingLeft: 22, marginTop: 8 }}>
          <li>
            <strong>Google</strong> — your name, email address, and a Google account identifier.
          </li>
          <li>
            <strong>Apple (Sign in with Apple)</strong> — your name (only the first time you sign
            in) and an email address, which may be an Apple private-relay address if you choose to
            hide your real one.
          </li>
          <li>
            <strong>Email and password</strong> — your email address.
          </li>
          <li>
            <strong>Guest</strong> — no name or email; we create only an anonymous account
            identifier so your data can persist until you choose to link a Google, Apple, or email
            account.
          </li>
        </ul>
        <p style={{ marginTop: 12 }}>
          We use this information to create and secure your Piel account. Authentication is handled
          by Supabase Auth; Google and Apple are the identity providers for their respective sign-in
          options.
        </p>
        <p style={{ marginTop: 12 }}>
          <strong>Content you create.</strong> The products on your shelf, your routine, your
          skin-type and profile settings, and your daily skin check-ins. This is stored so the app
          can show your data across sessions and keep your product verdicts (&ldquo;Halo&rdquo;)
          current.
        </p>
        <p style={{ marginTop: 12 }}>
          <strong>Diagnostics.</strong> We use Sentry to capture crash reports and basic performance
          data so we can fix problems. This is not linked to your identity — we do not send your
          email, name, or IP address to Sentry, and screen-recording (&ldquo;session replay&rdquo;)
          is disabled.
        </p>
        <p style={{ marginTop: 12 }}>
          We do <strong>not</strong> collect precise location, contacts, photos beyond what you
          explicitly submit, advertising identifiers, or any data for advertising or cross-app
          tracking. We do not sell your data.
        </p>
      </Section>

      <Section title="How your data is stored and shared">
        <p>
          Your account and content are stored using Supabase (Postgres) infrastructure. Diagnostics
          are processed by Sentry. These providers process data on our behalf under their own
          security and privacy terms. We share data only with these processors and only as needed to
          run the app, or where required by law.
        </p>
      </Section>

      <Section title="Data retention and deletion">
        <p>
          We keep your data while your account is active. You can{' '}
          <strong>delete your account and all associated data from within the app</strong> (Profile
          → Delete account), or by emailing us at the address below. Deletion removes your profile,
          shelf, routine, and check-ins from our systems.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Piel is not directed to children under 13 and we do not knowingly collect data from them.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You may request access to, correction of, or deletion of your data by contacting us.
          Depending on your region (e.g. EEA/UK GDPR, California CCPA) you may have additional
          rights.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this policy; material changes will be reflected by the &ldquo;Last
          updated&rdquo; date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          <strong>Piel</strong> —{' '}
          <a href="mailto:support@motovault.app" style={{ color: accent }}>
            support@motovault.app
          </a>
        </p>
      </Section>
    </article>
  );
}
