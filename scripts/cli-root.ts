/**
 * `--root=<dir>`: the repository a guard script works on. The default is the
 * checkout the script sits in; the tests pass a fixture tree, so that a guard
 * can be run as the process pre-push and CI run, exit status included.
 *
 * Only the `=` form is read. `--root <dir>`, a bare `--root`, an empty value
 * and a directory that does not exist end the process with one line and exit
 * status 1: falling back to the default would check the real checkout and
 * report on a tree the caller did not ask about.
 */
import { statSync } from 'node:fs';
import path from 'node:path';

const ROOT_FLAG = '--root';
const ROOT_PREFIX = `${ROOT_FLAG}=`;

function isDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** Why the `--root` in `argv` cannot be used, or the directory it names (`fallback` when there is none). */
function readRoot(fallback: string, argv: readonly string[]): { root: string } | { error: string } {
  if (argv.includes(ROOT_FLAG)) return { error: `takes its value after "=": ${ROOT_PREFIX}<dir>` };
  const flag = argv.find((arg) => arg.startsWith(ROOT_PREFIX));
  if (flag === undefined) return { root: fallback };
  const value = flag.slice(ROOT_PREFIX.length);
  if (value === '') return { error: `needs a directory: ${ROOT_PREFIX}<dir>` };
  const root = path.resolve(value);
  return isDirectory(root) ? { root } : { error: `${root} is not a directory` };
}

export function rootFromArgs(fallback: string, argv: readonly string[] = process.argv): string {
  const result = readRoot(fallback, argv);
  if ('root' in result) return result.root;
  console.error(`✗ ${ROOT_FLAG} ${result.error}`);
  process.exit(1);
}
