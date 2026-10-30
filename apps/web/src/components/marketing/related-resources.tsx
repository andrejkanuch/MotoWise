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

/** A hairline list of three next steps (`.mv-rows`), not a card grid. */
export async function RelatedResources({ angle }: { angle: CtaAngle }) {
  const t = await getTranslations('Blog');
  const links = LINKS_BY_ANGLE[angle];

  return (
    <section className="mv-read-section" aria-labelledby="related-resources-heading">
      <h2 id="related-resources-heading" className="mv-read-label">
        {t('relatedResourcesTitle')}
      </h2>
      <ul className="mv-rows">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="mv-row">
              <span className="mv-row-title">{t(link.labelKey)}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
