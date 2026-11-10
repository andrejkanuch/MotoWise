import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

/**
 * Boots the full AppModule dependency graph in a Nest testing module.
 *
 * GqlAuthGuard is both the APP_GUARD and a `@UseGuards` enhancer inside
 * feature modules (OemSchedulesModule, blog, entitlements...), so it is
 * instantiated in each of those modules' injectors: a new constructor
 * dependency on the guard breaks every one of them at boot, which no unit spec
 * notices. This compiles the real graph to catch that.
 *
 * Vitest's esbuild transform emits no decorator metadata, so Nest cannot
 * resolve constructor parameters by type here. The boot runs in a child process
 * under ts-node (transpile-only, which honours `emitDecoratorMetadata`), the
 * same way `generate:schema` boots the app. Env values are fakes: compile()
 * builds every provider without connecting to Supabase or answering requests.
 */
const API_ROOT = join(__dirname, '..');
const BOOT_TIMEOUT_MS = 120_000;
const BOOTED = 'BOOTED';

const BOOT_SCRIPT = `
const { Test } = require('@nestjs/testing');
const { AppModule } = require('./src/app.module');
const { OemSchedulesModule } = require('./src/modules/oem-schedules/oem-schedules.module');
const { GqlAuthGuard } = require('./src/common/guards/gql-auth.guard');
(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .setLogger({ log() {}, warn() {}, debug() {}, verbose() {}, error: console.error })
    .compile();
  const guards = [...moduleRef.get(require('@nestjs/core').ModulesContainer).values()]
    .filter((m) => m.metatype === OemSchedulesModule)
    .map((m) => m.injectables.get(GqlAuthGuard))
    .filter((wrapper) => wrapper && wrapper.instance instanceof GqlAuthGuard);
  if (guards.length !== 1) throw new Error('GqlAuthGuard not built inside OemSchedulesModule');
  console.log('${BOOTED}');
  await moduleRef.close();
  process.exit(0);
})().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
`;

const TEST_ENV = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://boot-test.supabase.co',
  SUPABASE_ANON_KEY: 'boot-test-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'boot-test-service-role',
  SUPABASE_JWT_SECRET: 'boot-test-jwt-secret',
  OPENAI_API_KEY: 'boot-test-openai',
};

describe('AppModule boot', () => {
  it(
    'compiles the full module graph, with GqlAuthGuard built inside OemSchedulesModule',
    async () => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [require.resolve('ts-node/dist/bin.js'), '--transpile-only', '-e', BOOT_SCRIPT],
        {
          cwd: API_ROOT,
          // Only PATH and HOME from the parent: a developer's real keys never reach the boot.
          env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...TEST_ENV },
          timeout: BOOT_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      expect(stdout).toContain(BOOTED);
    },
    BOOT_TIMEOUT_MS,
  );
});
