'use client';

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@uiw/react-codemirror';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// CodeMirror touches the DOM on mount; load it client-only to keep the admin
// route free of SSR `document is not defined` errors (KTD12 — source editor, not WYSIWYG).
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] rounded-lg border border-neutral-800 bg-neutral-950 animate-pulse" />
  ),
});

/**
 * Markdown SOURCE editor (plan KTD12). The body is MDX with JSX components and
 * `<!-- SPEC_TABLES_* -->` markers — a WYSIWYG would corrupt it on re-serialize,
 * so we edit the raw source losslessly. `blockJS:true` MDX render happens on the
 * public site (U7); this is purely an authoring surface.
 */
export function MarkdownEditor({
  value,
  onChange,
  height = '420px',
}: {
  value: string;
  onChange: (next: string) => void;
  height?: string;
}) {
  const extensions = useMemo(
    () => [markdown({ base: markdownLanguage }), EditorView.lineWrapping],
    [],
  );

  return (
    <div className="rounded-lg overflow-hidden border border-neutral-800">
      <CodeMirror
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
      />
    </div>
  );
}
