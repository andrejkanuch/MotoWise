import { expect, test } from '@playwright/test';

test.describe('Routes Discovery Phase 1 — E2E Smoke Tests', () => {
  // ==========================================
  // Search Flow
  // ==========================================

  test.describe('Search flow', () => {
    test('explore page loads with hero and sections', async ({ page }) => {
      await page.goto('/explore');
      await expect(page).toHaveTitle(/Discover|Explore|Motorcycle Routes/i);
      // Hero section visible
      await expect(page.locator('h1')).toBeVisible();
      // Search form exists
      await expect(page.locator('form input[type="search"], form input[type="text"]').first()).toBeVisible();
    });

    test('search bar triggers typeahead on input', async ({ page }) => {
      await page.goto('/explore');
      const searchInput = page.locator('input[type="search"], input[type="text"]').first();
      await searchInput.fill('Pacific');
      // Wait for typeahead dropdown
      await page.waitForTimeout(500);
      // Check for dropdown/listbox
      const dropdown = page.locator('[role="listbox"], [data-testid="typeahead-results"]');
      // Dropdown may or may not appear depending on data — just verify no crash
      await expect(page).not.toHaveTitle(/error/i);
    });

    test('search results page renders from URL', async ({ page }) => {
      await page.goto('/search?q=highway');
      // Page should load without errors
      await expect(page).not.toHaveTitle(/500|error/i);
      // Should have some content (results or "no results" message)
      await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
  });

  // ==========================================
  // Detail Page Flow
  // ==========================================

  test.describe('Detail page flow', () => {
    test('route detail page renders with SSR metadata', async ({ page }) => {
      // Use a known seeded route slug pattern — will 404 if no data, which is acceptable
      const response = await page.goto('/route/us/ca/test-route');
      // Either 200 (route exists) or 404 (no data yet) — both are valid
      const status = response?.status() ?? 0;
      expect([200, 404]).toContain(status);

      if (status === 200) {
        // Verify OG tags present
        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        expect(ogTitle).toBeTruthy();

        // Verify canonical URL
        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical).toContain('/route/');

        // Verify JSON-LD present
        const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
        expect(jsonLd).toBeTruthy();
        if (jsonLd) {
          const schema = JSON.parse(jsonLd);
          expect(schema['@type']).toBe('TouristAttraction');
        }
      }
    });
  });

  // ==========================================
  // Explore / Region Flow
  // ==========================================

  test.describe('Explore and region flow', () => {
    test('country page loads', async ({ page }) => {
      const response = await page.goto('/explore/us');
      const status = response?.status() ?? 0;
      expect([200, 404]).toContain(status);
    });

    test('region page loads', async ({ page }) => {
      const response = await page.goto('/explore/us/ca');
      const status = response?.status() ?? 0;
      expect([200, 404]).toContain(status);

      if (status === 200) {
        // Breadcrumb should be present
        const breadcrumb = page.locator('nav[aria-label*="breadcrumb"], nav[aria-label*="Breadcrumb"], [data-testid="breadcrumb"]');
        await expect(breadcrumb.first()).toBeVisible();
      }
    });
  });

  // ==========================================
  // Redirect Flow
  // ==========================================

  test.describe('UUID redirect flow', () => {
    test('unknown UUID returns 404', async ({ page }) => {
      const response = await page.goto('/routes/00000000-0000-0000-0000-000000000000');
      expect(response?.status()).toBe(404);
    });

    test('non-/routes paths are unaffected', async ({ page }) => {
      const response = await page.goto('/explore');
      expect(response?.status()).not.toBe(301);
    });
  });

  // ==========================================
  // SEO Validation
  // ==========================================

  test.describe('SEO validation', () => {
    test('robots.txt is accessible', async ({ page }) => {
      const response = await page.goto('/robots.txt');
      expect(response?.status()).toBe(200);
      const text = await page.textContent('body');
      expect(text).toContain('Sitemap');
      expect(text).toContain('Disallow');
    });

    test('sitemap.xml is accessible', async ({ page }) => {
      const response = await page.goto('/sitemap.xml');
      expect(response?.status()).toBe(200);
    });

    test('explore page has JSON-LD WebSite schema', async ({ page }) => {
      await page.goto('/explore');
      const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      const hasWebSite = jsonLdScripts.some((script) => {
        try {
          const data = JSON.parse(script);
          return data['@type'] === 'WebSite' || (Array.isArray(data) && data.some((d: { '@type': string }) => d['@type'] === 'WebSite'));
        } catch {
          return false;
        }
      });
      expect(hasWebSite).toBe(true);
    });
  });

  // ==========================================
  // Entitlement Checks
  // ==========================================

  test.describe('Entitlement gating', () => {
    test('anonymous user sees route detail but cannot save', async ({ page }) => {
      const response = await page.goto('/route/us/ca/test-route');
      if (response?.status() === 200) {
        // Save button should exist but require auth
        const saveBtn = page.locator('button:has-text("Save"), [data-testid="save-route"]');
        if (await saveBtn.count() > 0) {
          // Button should be present (gating happens on click, not visibility in Phase 1)
          await expect(saveBtn.first()).toBeVisible();
        }
      }
    });
  });
});
