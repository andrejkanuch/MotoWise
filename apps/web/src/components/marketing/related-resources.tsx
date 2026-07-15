import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CtaAngle } from '@/lib/blog-cta';

// Hub-and-spoke internal links: each article points down to a feature page, a
// tool, and the /compare money page (plan P4.3). Data-driven off the same angle
// the CTA uses, so the links always match the article's intent. Descriptive
// anchor text (localized) — internal-link anchors are an SEO ranking signal.
type ResourceLink = { href: string; labelKey: string };

const FEATURE_MAINTENANCE: ResourceLink = {
  href: '/features/maintenance',
  labelKey: 'relatedFeatureMaintenance',
};
const FEATURE_EXPENSES: ResourceLink = {
  href: '/features/expense-tracking',
  labelKey: 'relatedFeatureExpenses',
};
const TOOL_CHECKLIST: ResourceLink = {
  href: '/tools/tclocs-checklist',
  labelKey: 'relatedToolChecklist',
};
const TOOL_COST: ResourceLink = { href: '/tools/cost-calculator', labelKey: 'relatedToolCost' };
const COMPARE: ResourceLink = { href: '/compare', labelKey: 'relatedCompare' };

const LINKS_BY_ANGLE: Record<CtaAngle, ResourceLink[]> = {
  [CtaAngle.Maintenance]: [FEATURE_MAINTENANCE, TOOL_CHECKLIST, COMPARE],
  [CtaAngle.Cost]: [FEATURE_EXPENSES, TOOL_COST, COMPARE],
  [CtaAngle.Guide]: [FEATURE_MAINTENANCE, TOOL_CHECKLIST, COMPARE],
};

export async function RelatedResources({ angle }: { angle: CtaAngle }) {
  const t = await getTranslations('Blog');
  const links = LINKS_BY_ANGLE[angle];

  return (
    <section className="mt-16 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-neutral-400">
        {t('relatedResourcesTitle')}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-xl border border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-signature-500/40 hover:text-neutral-50"
            >
              {t(link.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
