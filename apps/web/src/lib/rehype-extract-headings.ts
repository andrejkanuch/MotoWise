import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { Root } from 'hast';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function rehypeExtractHeadings(headings: TocHeading[]) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: any) => {
      if (['h2', 'h3'].includes(node.tagName)) {
        headings.push({
          id: (node.properties?.id as string) || '',
          text: toString(node),
          level: Number(node.tagName[1]),
        });
      }
    });
  };
}
