import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { preprocessMarkdown } from '../utils/markdown';

const parseStyle = (styleStr?: string) => {
  if (!styleStr) return {};
  return styleStr.split(';').reduce((acc: any, style) => {
    const [key, ...values] = style.split(':');
    const value = values.join(':');
    if (key && value) {
      const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      acc[camelKey] = value.trim();
    }
    return acc;
  }, {});
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRendererImpl: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkMath]} 
      rehypePlugins={[rehypeKatex]}
      components={{
        span: ({ node, style, ...props }: any) => {
          const nodeStyle = node?.properties?.style;
          const parsedStyle = typeof nodeStyle === 'string' ? parseStyle(nodeStyle) : style;
          return <span style={parsedStyle} {...props} />;
        },
        code({node, inline, className, children, ...props}: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');
          return !inline && match ? (
            <SyntaxHighlighter
              {...props}
              children={codeStr}
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="rounded-lg border border-zinc-800 !bg-zinc-900/80 !m-0 !p-4 font-sans text-sm"
            />
          ) : (
            <code {...props} className={className ? `${className} bg-surface-container-highest border-2 border-primary rounded-sm px-1.5 py-0.5 font-mono text-[0.9em] text-primary` : 'bg-surface-container-highest border-2 border-primary rounded-sm px-1.5 py-0.5 font-mono text-[0.9em] text-primary'}>
              {children}
            </code>
          );
        }
      }}
    >
      {preprocessMarkdown(content)}
    </ReactMarkdown>
  );
};
