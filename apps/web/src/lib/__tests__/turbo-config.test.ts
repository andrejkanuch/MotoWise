import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8'));
}

describe('turbo.json configuration', () => {
  const turboConfig = readJson('turbo.json');

  it('uses $TURBO_DEFAULT$ for build inputs', () => {
    expect(turboConfig.tasks.build.inputs).toContain('$TURBO_DEFAULT$');
  });

  it('excludes test files from build inputs', () => {
    expect(turboConfig.tasks.build.inputs).toContain('!**/*.test.ts');
    expect(turboConfig.tasks.build.inputs).toContain('!**/*.spec.ts');
  });

  it('includes SENTRY_* env vars in build cache key', () => {
    expect(turboConfig.tasks.build.env).toContain('SENTRY_*');
  });

  it('includes MAPBOX_ACCESS_TOKEN in build cache key', () => {
    expect(turboConfig.tasks.build.env).toContain('MAPBOX_ACCESS_TOKEN');
  });

  it('includes biome.json in global dependencies', () => {
    expect(turboConfig.globalDependencies).toContain('biome.json');
  });

  it('includes test config files in test inputs', () => {
    expect(turboConfig.tasks.test.inputs).toContain('vitest.config.*');
    expect(turboConfig.tasks.test.inputs).toContain('jest.config.*');
  });

  it('includes tsconfig references in typecheck inputs', () => {
    expect(turboConfig.tasks.typecheck.inputs).toContain('tsconfig.*.json');
  });
});

describe('.env.example exists at repo root', () => {
  it('contains Supabase vars', () => {
    const envExample = readFileSync(path.join(REPO_ROOT, '.env.example'), 'utf-8');
    expect(envExample).toContain('SUPABASE_URL');
    expect(envExample).toContain('SUPABASE_ANON_KEY');
  });
});
