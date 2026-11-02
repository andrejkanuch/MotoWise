/**
 * Contract: every `NextIntlClientProvider` passes the namespaces its client
 * subtree reads, and only those.
 *
 * Passing the whole catalogue (57 namespaces, ~230 KB of JSON) serialised it
 * into every page's Flight payload (~97 KB gz per marketing page), so each
 * provider now picks a list. The risk of a list is the opposite failure: a
 * client component calls `useTranslations('X')` with X missing, and the page
 * throws at hydration. This test walks each provider's subtree on the
 * TypeScript AST (no DOM environment here, as in post-auth-contract) and
 * fails when a client component reads a namespace its provider does not pass.
 *
 * Subtree of a provider:
 * - the JSX components rendered inside the element (and local components
 *   they render), followed through their imports;
 * - when it wraps `{children}` in a `layout.tsx`, every file of that route
 *   directory (minus nested directories that have their own provider);
 *   when it wraps `{children}` in a shared component, the route directories
 *   of the layouts that render that component.
 * A file is client when it starts with 'use client' or is imported from a
 * client file. `next/dynamic` / `import()` targets are followed too.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = path.join(process.cwd(), 'src');
const APP = path.join(SRC, 'app');
const PROVIDER = 'NextIntlClientProvider';
const USE_TRANSLATIONS = 'useTranslations';
const PICK_CALLEE = 'pickNamespaces';
const SOURCE_EXT = ['.tsx', '.ts'];
const SKIP_DIR = '__tests__';

// ── files and parsing ────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === SKIP_DIR ? [] : walkDir(full);
    return SOURCE_EXT.includes(path.extname(entry.name)) && !entry.name.includes('.test.')
      ? [full]
      : [];
  });
}

const parsed = new Map<string, ts.SourceFile>();
function parse(file: string): ts.SourceFile {
  const hit = parsed.get(file);
  if (hit) return hit;
  const sf = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  parsed.set(file, sf);
  return sf;
}

function collect<T extends ts.Node>(root: ts.Node, guard: (n: ts.Node) => n is T): T[] {
  const out: T[] = [];
  const visit = (n: ts.Node) => {
    if (guard(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(root);
  return out;
}

function resolveModule(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  const candidates = [
    base,
    ...SOURCE_EXT.map((ext) => base + ext),
    ...SOURCE_EXT.map((ext) => path.join(base, `index${ext}`)),
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

const isClientFile = (sf: ts.SourceFile) => {
  const first = sf.statements[0];
  return (
    !!first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use client'
  );
};

/** `import { X } from '…'` / `import X from '…'` → resolved file, per local name. */
function importMap(file: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const st of parse(file).statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const target = resolveModule(file, (st.moduleSpecifier as ts.StringLiteral).text);
    if (!target) continue;
    if (st.importClause.name) map.set(st.importClause.name.text, target);
    const bindings = st.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) map.set(el.name.text, target);
    }
  }
  return map;
}

// ── namespaces a subtree reads ───────────────────────────────────────────────

/** Namespace → the first `file:line` that reads it on the client. */
type Reads = { namespaces: Map<string, string>; problems: string[] };

const ALL = '*';
const DEFAULT = 'default';

/** Top-level declarations by name (a module's own symbols). */
function topLevel(file: string): Map<string, ts.Node> {
  const map = new Map<string, ts.Node>();
  for (const st of parse(file).statements) {
    const isDefault = ts.canHaveModifiers(st)
      ? (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      : false;
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) {
      map.set(st.name.text, st);
      if (isDefault) map.set(DEFAULT, st);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) map.set(d.name.text, d);
      }
    } else if (ts.isExportAssignment(st)) {
      map.set(DEFAULT, st);
    }
  }
  return map;
}

/** Statements that run on import whatever is imported (not declarations, not imports). */
function moduleBody(file: string): ts.Node[] {
  return parse(file).statements.filter(
    (st) =>
      ts.isExpressionStatement(st) &&
      !(ts.isStringLiteral(st.expression) && st.expression.text === 'use client'),
  );
}

/** Local name → { file, imported symbol } for value imports. */
function importBindings(file: string): Map<string, { file: string; symbol: string }> {
  const map = new Map<string, { file: string; symbol: string }>();
  for (const st of parse(file).statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const target = resolveModule(file, (st.moduleSpecifier as ts.StringLiteral).text);
    if (!target) continue;
    if (st.importClause.name) map.set(st.importClause.name.text, { file: target, symbol: DEFAULT });
    const bindings = st.importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      map.set(bindings.name.text, { file: target, symbol: ALL });
    } else if (bindings) {
      for (const el of bindings.elements) {
        if (el.isTypeOnly) continue;
        map.set(el.name.text, { file: target, symbol: (el.propertyName ?? el.name).text });
      }
    }
  }
  return map;
}

/** `export { a } from` / `export * from` targets for one requested symbol. */
function reExports(file: string, symbol: string): { file: string; symbol: string }[] {
  const out: { file: string; symbol: string }[] = [];
  for (const st of parse(file).statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || st.isTypeOnly) continue;
    const target = resolveModule(file, (st.moduleSpecifier as ts.StringLiteral).text);
    if (!target) continue;
    const clause = st.exportClause;
    if (!clause || !ts.isNamedExports(clause)) {
      out.push({ file: target, symbol });
      continue;
    }
    for (const el of clause.elements) {
      if (symbol === ALL || el.name.text === symbol) {
        out.push({
          file: target,
          symbol: symbol === ALL ? ALL : (el.propertyName ?? el.name).text,
        });
      }
    }
  }
  return out;
}

/** The top-level nodes a symbol pulls in, through same-file references. */
function reachedNodes(file: string, symbol: string): ts.Node[] {
  const decls = topLevel(file);
  if (symbol === ALL) return [...new Set(decls.values()), ...moduleBody(file)];
  const reached = new Set<ts.Node>(moduleBody(file));
  const pending = [decls.get(symbol)].filter((n): n is ts.Node => !!n);
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || reached.has(node)) continue;
    reached.add(node);
    for (const id of collect(node, ts.isIdentifier)) {
      const decl = decls.get(id.text);
      if (decl && !reached.has(decl)) pending.push(decl);
    }
  }
  return [...reached];
}

function translationReads(file: string, nodes: ts.Node[], reads: Reads) {
  const sf = parse(file);
  for (const call of nodes.flatMap((n) => collect(n, ts.isCallExpression))) {
    if (call.expression.getText(sf) !== USE_TRANSLATIONS) continue;
    const [arg] = call.arguments;
    const where = `${path.relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(call.getStart()).line + 1}`;
    if (!arg) reads.problems.push(`${where} reads every namespace (useTranslations())`);
    else if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      const ns = arg.text.split('.')[0];
      if (!reads.namespaces.has(ns)) reads.namespaces.set(ns, where);
    } else reads.problems.push(`${where} passes a non-literal namespace`);
  }
}

/**
 * Walks the import graph symbol by symbol (importing `storeAnchorProps` from a
 * module does not pull in the module's `StoreLink` and its translations).
 */
function clientReads(roots: string[]): Reads {
  const reads: Reads = { namespaces: new Map(), problems: [] };
  const seen = new Set<string>();
  const queue = roots.map((file) => ({ file, symbol: ALL, client: false }));
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const client = next.client || isClientFile(parse(next.file));
    const key = `${next.file}|${next.symbol}|${client}`;
    if (seen.has(key) || seen.has(`${next.file}|${ALL}|${client}`)) continue;
    seen.add(key);

    const nodes = reachedNodes(next.file, next.symbol);
    if (client) translationReads(next.file, nodes, reads);

    const bindings = importBindings(next.file);
    const used = new Set(nodes.flatMap((n) => collect(n, ts.isIdentifier)).map((id) => id.text));
    for (const [local, target] of bindings) {
      if (used.has(local)) queue.push({ ...target, client });
    }
    for (const target of reExports(next.file, next.symbol)) queue.push({ ...target, client });
    for (const call of nodes.flatMap((n) => collect(n, ts.isCallExpression))) {
      const [arg] = call.arguments;
      if (call.expression.kind === ts.SyntaxKind.ImportKeyword && arg && ts.isStringLiteral(arg)) {
        const target = resolveModule(next.file, arg.text);
        if (target) queue.push({ file: target, symbol: ALL, client });
      }
    }
  }
  return reads;
}

// ── provider sites ───────────────────────────────────────────────────────────

type Site = { file: string; element: ts.JsxElement };

function providerSites(): Site[] {
  return walkDir(SRC).flatMap((file) =>
    collect(parse(file), ts.isJsxElement)
      .filter((el) => el.openingElement.tagName.getText() === PROVIDER)
      .map((element) => ({ file, element })),
  );
}

const unwrap = (e: ts.Expression): ts.Expression =>
  ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e)
    ? unwrap(e.expression)
    : e;

function objectKeys(e: ts.Expression): string[] | null {
  const obj = unwrap(e);
  if (!ts.isObjectLiteralExpression(obj)) return null;
  return obj.properties.map((p) => p.name?.getText().replace(/['"]/g, '') ?? '');
}

function stringArray(e: ts.Expression): string[] | null {
  const arr = unwrap(e);
  if (!ts.isArrayLiteralExpression(arr)) return null;
  return arr.elements.map((el) => (ts.isStringLiteral(el) ? el.text : ''));
}

function variableInitializer(sf: ts.SourceFile, name: string): ts.Expression | undefined {
  return collect(sf, ts.isVariableDeclaration).find(
    (d) => ts.isIdentifier(d.name) && d.name.text === name,
  )?.initializer;
}

/** Name of the function component that declares `param` as a destructured prop. */
function componentOfProp(sf: ts.SourceFile, param: string): string | null {
  for (const fn of collect(sf, ts.isFunctionDeclaration)) {
    const [props] = fn.parameters;
    if (
      props &&
      ts.isObjectBindingPattern(props.name) &&
      props.name.elements.some((el) => el.name.getText() === param)
    ) {
      return fn.name?.text ?? null;
    }
  }
  return null;
}

/** Files that render `<Component …>` imported from `file`. */
function renderersOf(file: string, component: string): string[] {
  return walkDir(SRC).filter(
    (f) => f !== file && importMap(f).get(component) === file && jsxTags(parse(f)).has(component),
  );
}

function jsxTags(node: ts.Node): Set<string> {
  const tags = new Set<string>();
  for (const el of collect(
    node,
    (n): n is ts.JsxOpeningElement | ts.JsxSelfClosingElement =>
      ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n),
  )) {
    tags.add(el.tagName.getText());
  }
  return tags;
}

/** The namespaces a provider passes; null when the `messages` value is not a literal list. */
function passedNamespaces(site: Site): string[] | null {
  const sf = parse(site.file);
  const attr = site.element.openingElement.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'messages',
  );
  const value = attr?.initializer;
  if (!value || !ts.isJsxExpression(value) || !value.expression) return null;
  const expr = unwrap(value.expression);
  const literal = objectKeys(expr);
  if (literal) return literal;
  if (!ts.isIdentifier(expr)) return null;

  const init = variableInitializer(sf, expr.text);
  if (init) {
    const call = unwrap(init);
    if (ts.isCallExpression(call) && call.expression.getText(sf) === PICK_CALLEE) {
      const list = call.arguments[1];
      if (!list || !ts.isIdentifier(list)) return null;
      const listInit = variableInitializer(sf, list.text);
      return listInit ? stringArray(listInit) : null;
    }
    return objectKeys(init);
  }

  // A prop (root-shell's cookieBannerMessages): every renderer must pass a literal.
  const component = componentOfProp(sf, expr.text);
  if (!component) return null;
  const perCaller = renderersOf(site.file, component).map((caller) => {
    const callerSf = parse(caller);
    const el = collect(
      callerSf,
      (n): n is ts.JsxOpeningElement | ts.JsxSelfClosingElement =>
        (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) &&
        n.tagName.getText() === component,
    )[0];
    const prop = el?.attributes.properties.find(
      (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === expr.text,
    )?.initializer;
    return prop && ts.isJsxExpression(prop) && prop.expression ? objectKeys(prop.expression) : null;
  });
  if (perCaller.length === 0 || perCaller.some((keys) => keys === null)) return null;
  const [first, ...rest] = perCaller as string[][];
  return first.filter((ns) => rest.every((keys) => keys.includes(ns)));
}

function wrapsChildren(element: ts.JsxElement): boolean {
  return collect(element, ts.isJsxExpression).some(
    (e) => !!e.expression && ts.isIdentifier(e.expression) && e.expression.text === 'children',
  );
}

/** Route directories whose layouts host a provider of their own. */
function nestedProviderDirs(sites: Site[]): string[] {
  return sites
    .filter((s) => path.basename(s.file) === 'layout.tsx')
    .map((s) => path.dirname(s.file));
}

function routeFiles(dir: string, sites: Site[]): string[] {
  const nested = nestedProviderDirs(sites).filter((d) => d !== dir && d.startsWith(dir + path.sep));
  return walkDir(dir).filter((f) => !nested.some((d) => f.startsWith(d + path.sep)));
}

function subtreeRoots(site: Site, sites: Site[]): string[] {
  const sf = parse(site.file);
  const imports = importMap(site.file);
  const roots = new Set<string>();

  // Components rendered inside the element, through same-file components.
  const pending = [...jsxTags(site.element)];
  const visitedLocal = new Set<string>();
  while (pending.length > 0) {
    const tag = pending.pop();
    if (!tag || visitedLocal.has(tag)) continue;
    visitedLocal.add(tag);
    const imported = imports.get(tag);
    if (imported) {
      roots.add(imported);
      continue;
    }
    const local = collect(sf, ts.isFunctionDeclaration).find((fn) => fn.name?.text === tag);
    if (local) pending.push(...jsxTags(local));
  }

  if (wrapsChildren(site.element)) {
    if (path.basename(site.file) === 'layout.tsx') {
      for (const f of routeFiles(path.dirname(site.file), sites)) {
        if (f !== site.file) roots.add(f);
      }
    } else {
      const component = collect(sf, ts.isFunctionDeclaration).find(
        (fn) => site.element.getStart() >= fn.getStart() && site.element.getEnd() <= fn.getEnd(),
      )?.name?.text;
      const layouts = component ? renderersOf(site.file, component) : [];
      for (const layout of layouts) {
        for (const f of routeFiles(path.dirname(layout), sites)) {
          if (f !== layout) roots.add(f);
        }
      }
    }
  }
  return [...roots];
}

// ── the contract ─────────────────────────────────────────────────────────────

const sites = providerSites();

describe('NextIntlClientProvider namespace contract', () => {
  it('finds the providers (root shell, [locale], root-only sections, auth, welcome)', () => {
    const files = sites.map((s) => path.relative(SRC, s.file));
    expect(files).toEqual(
      expect.arrayContaining([
        'app/root-shell.tsx',
        'app/[locale]/layout.tsx',
        'app/(root)/(community)/layout.tsx',
        'components/auth-ui/auth-intl-layout.tsx',
      ]),
    );
    expect(sites.length).toBeGreaterThanOrEqual(9);
  });

  it.each(
    sites.map((s) => [path.relative(SRC, s.file), s] as const),
  )('%s passes a literal namespace list that covers its client subtree', (_name, site) => {
    const passed = passedNamespaces(site);
    expect(
      passed,
      'messages must be a literal namespace list, not the whole catalogue',
    ).not.toBeNull();

    const reads = clientReads(subtreeRoots(site, sites));
    expect(reads.problems).toEqual([]);
    const missing = [...reads.namespaces]
      .filter(([ns]) => !passed?.includes(ns))
      .map(([ns, where]) => `${ns} (${where})`)
      .sort();
    expect(missing, 'namespaces read on the client but not passed').toEqual([]);
  });

  it('every passed namespace exists in en.json', () => {
    const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/en.json'), 'utf8'));
    for (const site of sites) {
      const unknown = (passedNamespaces(site) ?? []).filter((ns) => !(ns in en));
      expect(unknown, path.relative(APP, site.file)).toEqual([]);
    }
  });
});
