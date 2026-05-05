import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { TripCard } from '@/components/guides/trip-card';
import type { TocHeading } from '@/lib/rehype-extract-headings';
import { rehypeExtractHeadings } from '@/lib/rehype-extract-headings';

export interface GuideFrontmatter {
  title: string;
  description: string;
  author: string;
  date: string;
  trips: string[];
  keywords: string[];
  heroImage?: string;
}

export interface Guide {
  slug: string;
  frontmatter: GuideFrontmatter;
}

export interface CompiledGuide {
  slug: string;
  frontmatter: GuideFrontmatter;
  content: React.ReactElement;
  headings: TocHeading[];
}

const GUIDES_DIR = path.join(process.cwd(), 'src/content/guides');

const guidesCache = new Map<string, { guides: Guide[]; timestamp: number }>();
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 300_000 : 5_000;

function readGuidesFromDisk(): Guide[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => {
      const source = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
      const { data } = matter(source);
      return {
        slug: file.replace('.mdx', ''),
        frontmatter: {
          title: data.title || '',
          description: data.description || '',
          author: data.author || 'MotoVault Team',
          date: data.date || '',
          trips: data.trips || [],
          keywords: data.keywords || [],
          heroImage: data.heroImage,
        },
      } satisfies Guide;
    })
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}

export function getGuides(): Guide[] {
  const cached = guidesCache.get('all');
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.guides;

  const guides = readGuidesFromDisk();
  guidesCache.set('all', { guides, timestamp: Date.now() });
  return guides;
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return getGuides().find((g) => g.slug === slug);
}

export function getGuideSlugs(): string[] {
  return getGuides().map((g) => g.slug);
}

const mdxComponents = {
  TripCard,
  h2: (props: React.ComponentProps<'h2'>) => (
    <h2 className="mt-12 mb-4 text-2xl font-bold text-neutral-50" {...props} />
  ),
  h3: (props: React.ComponentProps<'h3'>) => (
    <h3 className="mt-8 mb-3 text-xl font-semibold text-neutral-100" {...props} />
  ),
  p: (props: React.ComponentProps<'p'>) => (
    <p className="mb-4 leading-relaxed text-neutral-300" {...props} />
  ),
  a: (props: React.ComponentProps<'a'>) => (
    <a className="text-amber-400 underline hover:text-amber-300" {...props} />
  ),
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-neutral-300" {...props} />
  ),
  ol: (props: React.ComponentProps<'ol'>) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 text-neutral-300" {...props} />
  ),
  li: (props: React.ComponentProps<'li'>) => <li className="text-neutral-300" {...props} />,
  strong: (props: React.ComponentProps<'strong'>) => (
    <strong className="text-neutral-200" {...props} />
  ),
  table: (props: React.ComponentProps<'table'>) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm text-neutral-300" {...props} />
    </div>
  ),
  th: (props: React.ComponentProps<'th'>) => (
    <th
      className="border border-neutral-700 bg-neutral-800 px-4 py-2 text-left font-semibold text-neutral-200"
      {...props}
    />
  ),
  td: (props: React.ComponentProps<'td'>) => (
    <td className="border border-neutral-800 px-4 py-2" {...props} />
  ),
  blockquote: (props: React.ComponentProps<'blockquote'>) => (
    <blockquote
      className="my-6 border-l-4 border-amber-500/50 pl-4 italic text-neutral-400"
      {...props}
    />
  ),
};

/** Compile a guide's MDX content. Wrapped with React.cache() to deduplicate within a request. */
export const compileGuide = cache(async (slug: string): Promise<CompiledGuide | null> => {
  const filePath = path.join(GUIDES_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, 'utf-8');
  const { data, content: rawContent } = matter(source);
  const headings: TocHeading[] = [];

  const { content } = await compileMDX({
    source: rawContent,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeExtractHeadings(headings)],
      },
    },
    components: mdxComponents,
  });

  return {
    slug,
    frontmatter: {
      title: data.title || '',
      description: data.description || '',
      author: data.author || 'MotoVault Team',
      date: data.date || '',
      trips: data.trips || [],
      keywords: data.keywords || [],
      heroImage: data.heroImage,
    },
    content,
    headings,
  };
});
