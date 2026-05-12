import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = path.resolve(__dirname, '../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), 'utf-8');
}

describe('Core Web Vitals optimizations', () => {
  describe('LCP: Hero image optimization', () => {
    const heroSrc = readSource('src/components/marketing/hero.tsx');

    it('uses next/image instead of CSS backgroundImage for hero slides', () => {
      expect(heroSrc).toContain("import Image from 'next/image'");
      // Hero slide images should not use backgroundImage with url() for jpg/png
      expect(heroSrc).not.toMatch(/backgroundImage:.*url\(.*\.(jpg|png|webp)/);
    });

    it('sets priority on the first hero image for LCP', () => {
      expect(heroSrc).toContain('priority={idx === 0}');
    });

    it('uses eager loading for first image, lazy for rest', () => {
      expect(heroSrc).toContain("loading={idx === 0 ? 'eager' : 'lazy'}");
    });

    it('uses full viewport width for sizes hint', () => {
      expect(heroSrc).toContain('sizes="100vw"');
    });
  });

  describe('CLS: Footer stability', () => {
    const cssSrc = readSource('src/components/marketing/design-system.css');

    it('footer has layout containment', () => {
      // After .mv-footer selector, should have contain property
      const footerBlock = cssSrc.slice(cssSrc.indexOf('.mv-footer {'));
      expect(footerBlock).toContain('contain: layout style');
    });

    it('footer wordmark has explicit min-height', () => {
      const wordmarkBlock = cssSrc.slice(cssSrc.indexOf('.mv-footer-wordmark {'));
      expect(wordmarkBlock).toContain('min-height:');
    });
  });

  describe('CLS: Content visibility', () => {
    const globalsCss = readSource('src/app/globals.css');

    it('excludes footer from content-visibility: auto', () => {
      expect(globalsCss).toContain('footer.mv-footer');
      expect(globalsCss).toContain('content-visibility: visible');
    });

    it('below-fold sections use content-visibility: auto', () => {
      expect(globalsCss).toContain('section:not(:first-child)');
      expect(globalsCss).toContain('content-visibility: auto');
    });
  });

  describe('INP: Ghost button performance', () => {
    const cssSrc = readSource('src/components/marketing/design-system.css');

    it('ghost buttons do not use backdrop-filter (expensive for INP)', () => {
      const ghostBlock = cssSrc.slice(
        cssSrc.indexOf('.mv-btn-ghost {'),
        cssSrc.indexOf('.mv-btn-ghost:hover'),
      );
      expect(ghostBlock).not.toContain('backdrop-filter');
    });
  });

  describe('Image config optimization', () => {
    const configSrc = readSource('next.config.ts');

    it('enables AVIF and WebP formats', () => {
      expect(configSrc).toContain('image/avif');
      expect(configSrc).toContain('image/webp');
    });

    it('sets long cache TTL for optimized images', () => {
      expect(configSrc).toContain('minimumCacheTTL');
    });
  });

  describe('Font CLS prevention', () => {
    const layoutSrc = readSource('src/app/layout.tsx');
    const marketingLayoutSrc = readSource('src/app/[locale]/(marketing)/layout.tsx');

    it('root font has adjustFontFallback enabled', () => {
      expect(layoutSrc).toContain('adjustFontFallback: true');
    });

    it('Instrument Serif has adjustFontFallback enabled', () => {
      expect(marketingLayoutSrc).toContain('adjustFontFallback: true');
    });
  });

  describe('Security headers for static assets', () => {
    const configSrc = readSource('next.config.ts');

    it('sets X-Content-Type-Options on image routes', () => {
      expect(configSrc).toContain('X-Content-Type-Options');
      expect(configSrc).toContain('nosniff');
    });

    it('caches _next/static assets immutably', () => {
      expect(configSrc).toContain('/_next/static/:path*');
    });
  });

  describe('Client router cache (staleTimes)', () => {
    const configSrc = readSource('next.config.ts');

    it('configures staleTimes for navigation caching', () => {
      expect(configSrc).toContain('staleTimes');
    });
  });
});
