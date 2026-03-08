import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'MotoWise privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
      <h1>Privacy Policy</h1>
      <p className="text-neutral-400">Last updated: March 8, 2026</p>

      <h2>Information We Collect</h2>
      <p>
        When you create a MotoWise account, we collect your email address and display name. When you
        use AI diagnostics, uploaded images are processed for analysis and are not stored
        permanently. Motorcycle data you add to your garage is stored securely in your account.
      </p>

      <h2>How We Use Your Information</h2>
      <p>
        We use your information to provide and improve MotoWise&apos;s services, including
        personalized learning recommendations, AI diagnostic analysis, and garage management. We do
        not sell your personal information to third parties.
      </p>

      <h2>Data Security</h2>
      <p>
        MotoWise uses Supabase with row-level security policies to protect your data. Authentication
        tokens are stored securely using platform-native secure storage. All data is transmitted
        over HTTPS.
      </p>

      <h2>Your Rights</h2>
      <p>
        You can export or delete your data at any time from your profile settings. For questions
        about your data, contact us at privacy@motowise.app.
      </p>
    </article>
  );
}
