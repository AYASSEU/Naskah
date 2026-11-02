'use client';
import { memo, Children, cloneElement, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GuardrailReport } from '@naskah/contracts';
function markText(children: ReactNode, rewrites: GuardrailReport['rewrites']): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      let fragments: ReactNode[] = [child];
      for (const r of rewrites.filter((r) => !r.resolved))
        fragments = fragments.flatMap<ReactNode>((part, i) => {
          if (typeof part !== 'string' || !part.includes(r.rewritten)) return [part];
          const parts = part.split(r.rewritten);
          return parts.flatMap<ReactNode>((p, j) =>
            j
              ? [
                  <mark
                    key={`${r.id}-${i}-${j}`}
                    title={`${r.original} — ${r.reason}`}
                    tabIndex={0}
                  >
                    {r.rewritten}
                  </mark>,
                  p,
                ]
              : [p],
          );
        });
      return fragments;
    }
    if (isValidElement(child))
      return cloneElement(
        child as ReactElement<{ children?: ReactNode }>,
        {},
        markText((child.props as { children?: ReactNode }).children, rewrites),
      );
    return child;
  });
}
export const Markdown = memo(function Markdown({
  text,
  rewrites = [],
}: {
  text: string;
  rewrites?: GuardrailReport['rewrites'];
}) {
  return (
    <div className="manuscript-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{markText(children, rewrites)}</p>,
          a: ({ children, href }) => (
            <a href={href} rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
