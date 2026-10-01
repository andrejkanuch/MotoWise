// The CarPlay cold-launch contract. On a CarPlay-only launch the phone UI (and the
// expo-router root layout) may never mount, so the coordinator must be registered by
// the bundle entry itself, before the router — otherwise the head unit shows a blank
// screen until the rider opens the phone app.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../carplay-coordinator', () => ({ startCarPlayCoordinator: jest.fn() }));

const APP_ROOT = join(__dirname, '../../../..');
const read = (rel: string) => readFileSync(join(APP_ROOT, rel), 'utf8');

describe('carplay-entry', () => {
  it('starts the coordinator exactly once on evaluation', () => {
    const { startCarPlayCoordinator } = jest.requireMock('../carplay-coordinator');
    require('../carplay-entry');
    expect(startCarPlayCoordinator).toHaveBeenCalledTimes(1);
  });

  it('is the bundle entry, imported before expo-router', () => {
    expect(JSON.parse(read('package.json')).main).toBe('index.ts');
    const entry = read('index.ts');
    const carplay = entry.indexOf("import './src/features/carplay/carplay-entry';");
    const router = entry.indexOf("import 'expo-router/entry';");
    expect(carplay).toBeGreaterThan(-1);
    expect(router).toBeGreaterThan(carplay);
  });

  // The library's timer swap only helps if nothing has captured setTimeout yet.
  it('installs the lock-screen-safe timers before any other import', () => {
    const imports = read('index.ts')
      .split('\n')
      .filter((line) => line.startsWith('import '));
    expect(imports[0]).toBe("import './src/features/carplay/install-timers';");
  });

  it('keeps the phone UI graph out of the entry path', () => {
    for (const file of [
      'src/features/carplay/carplay-entry.ts',
      'src/features/carplay/carplay-coordinator.ts',
    ]) {
      expect(read(file)).not.toMatch(/from '(\.\.\/)+app\//);
    }
  });

  it('is no longer started from the root layout', () => {
    expect(read('src/app/_layout.tsx')).not.toContain('startCarPlayCoordinator');
  });
});
