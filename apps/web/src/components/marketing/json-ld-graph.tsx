/**
 * Emits a single `<script type="application/ld+json">` containing a
 * consolidated `@graph` — the pattern Google's crawler rewards over multiple
 * separate JSON-LD blocks. Escapes `<` as `\u003c` per the prior learning in
 * docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md so
 * malicious strings cannot break out with `</script>`.
 */
export function JsonLdGraph({ nodes }: { nodes: Record<string, unknown>[] }) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, '\\u003c'),
      }}
    />
  );
}
