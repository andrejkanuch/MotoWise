/**
 * `--root=<dir>`: the repository a guard script works on. The default is the
 * checkout the script sits in; the tests pass a fixture tree, so that a guard
 * can be run as the process pre-push and CI run, exit status included.
 */
import path from 'node:path';

const ROOT_FLAG = '--root=';

export function rootFromArgs(fallback: string, argv: readonly string[] = process.argv): string {
  const flag = argv.find((arg) => arg.startsWith(ROOT_FLAG));
  return flag ? path.resolve(flag.slice(ROOT_FLAG.length)) : fallback;
}
