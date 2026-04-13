// Ambient module declarations for non-code imports bundled by wrangler.
//
// Wrangler ships `.md` files as Text modules when configured via
// `[[rules]]` in wrangler.toml. At build time the content is inlined as
// a string default export. TypeScript needs to know about the module
// shape ahead of time, since tsc doesn't run the bundler.
//
// `.json` imports work without a declaration because
// `resolveJsonModule: true` is set in tsconfig.json.

declare module '*.md' {
  const content: string;
  export default content;
}
