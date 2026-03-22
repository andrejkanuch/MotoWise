import type { Element, Root } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function rehypeExtractHeadings(headings: TocHeading[]) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (['h2', 'h3'].includes(node.tagName)) {
        headings.push({
          id: (node.properties?.id as string) || '',
          text: hastToString(node),
          level: Number(node.tagName[1]),
        });
      }
    });
  };
}
