import { getArticles } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const articles = getArticles('en');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MotoVault Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Motorcycle maintenance tips, AI diagnostics, and riding guides from MotoVault</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    ${articles
      .map(
        (a) => `<item>
      <title>${escapeXml(a.title)}</title>
      <link>${BASE_URL}/blog/${a.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${a.slug}</guid>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <description>${escapeXml(a.excerpt)}</description>
    </item>`,
      )
      .join('\n    ')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
