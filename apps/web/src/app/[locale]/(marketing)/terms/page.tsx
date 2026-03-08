import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'MotoWise terms of service — rules and guidelines for using our platform.',
};

export default function TermsPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
      <h1>Terms of Service</h1>
      <p className="text-neutral-400">Last updated: March 8, 2026</p>

      <h2>Acceptance of Terms</h2>
      <p>
        By accessing or using MotoWise, you agree to be bound by these Terms of Service. If you do
        not agree, please do not use our services.
      </p>

      <h2>Use of Service</h2>
      <p>
        MotoWise provides AI-powered motorcycle learning content and diagnostic tools for
        informational purposes. Our AI diagnostics are designed to assist — not replace —
        professional motorcycle mechanic advice. Always consult a qualified mechanic for critical
        safety issues.
      </p>

      <h2>User Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials. You
        agree to provide accurate information when creating your account and to update it as needed.
      </p>

      <h2>Intellectual Property</h2>
      <p>
        All content, features, and functionality of MotoWise are owned by MotoWise and are protected
        by copyright and other intellectual property laws. Learning content may not be reproduced
        without permission.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        MotoWise is provided &quot;as is&quot; without warranties of any kind. We are not liable for
        any damages arising from your use of the service or reliance on AI diagnostic results.
      </p>
    </article>
  );
}
