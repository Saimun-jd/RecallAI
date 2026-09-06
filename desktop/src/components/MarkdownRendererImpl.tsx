import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ImageIcon, ZoomIn, X, ExternalLink } from 'lucide-react';
import { preprocessMarkdown } from '../utils/markdown';
import { API_BASE } from '../api/client';

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

interface DiagramImageProps {
  src?: string;
  alt?: string;
  [key: string]: any;
}

export const DiagramImage: React.FC<DiagramImageProps> = ({ src, alt, ...props }) => {
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isZoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isZoomed]);

  const resolveImageUrl = (rawSrc?: string) => {
    if (!rawSrc) return '';
    if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://') || rawSrc.startsWith('data:')) {
      return rawSrc;
    }
    // Clean relative path (e.g. "./images/fig1.png" -> "fig1.png", "images/fig1.png" -> "fig1.png")
    const clean = rawSrc.replace(/^\.?\/*(images\/)?/, '');
    return `${API_BASE}/images/${clean}`;
  };

  const resolvedSrc = resolveImageUrl(src);

  if (hasError || !resolvedSrc) {
    return (
      <div className="my-4 flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/60 text-on-surface-variant text-sm select-none">
        <div className="p-2 rounded-lg bg-surface-container-highest text-primary shrink-0">
          <ImageIcon className="w-5 h-5 opacity-80" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs text-on-surface flex items-center gap-1.5">
            <span>Diagram / Figure</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-container-highest text-outline font-semibold">
              Figure
            </span>
          </div>
          <p className="text-xs text-on-surface-variant/80 mt-0.5 truncate">
            {alt || (src ? src.split('/').pop() : 'Visual diagram or schematic')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <figure className="my-4 group relative rounded-xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden shadow-xs hover:border-primary/40 transition-all duration-200">
        <div
          className="relative overflow-hidden cursor-zoom-in flex items-center justify-center p-2 bg-surface-container-low/20"
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={resolvedSrc}
            alt={alt || 'Diagram'}
            onError={() => setHasError(true)}
            className="max-h-[480px] w-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
            loading="lazy"
            {...props}
          />
          {/* Zoom Hint Badge */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-highest/90 text-on-surface backdrop-blur-xs px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 shadow-xs pointer-events-none">
            <ZoomIn className="w-3.5 h-3.5 text-primary" />
            <span>Click to zoom</span>
          </div>
        </div>
        {alt && (
          <figcaption className="px-3.5 py-2 text-xs text-center text-on-surface-variant/90 border-t border-outline-variant/20 bg-surface-container-low/40 italic">
            {alt}
          </figcaption>
        )}
      </figure>

      {/* Fullscreen Lightbox Modal */}
      {isZoomed && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsZoomed(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(resolvedSrc, '_blank');
              }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Open original image in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsZoomed(false)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvedSrc}
              alt={alt || 'Diagram view'}
              className="max-h-[80vh] max-w-[88vw] object-contain rounded-lg shadow-2xl bg-surface-container-lowest"
            />
            {alt && (
              <p className="mt-3 text-sm text-white/90 text-center max-w-2xl px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-xs">
                {alt}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRendererImpl: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      components={{
        img: ({ node, src, alt, ...props }: any) => {
          return <DiagramImage src={src} alt={alt} {...props} />;
        },
        span: ({ node, style, ...props }: any) => {
          const nodeStyle = node?.properties?.style;
          const parsedStyle = typeof nodeStyle === 'string' ? parseStyle(nodeStyle) : style;
          return <span style={parsedStyle} {...props} />;
        },
        code({ node, inline, className, children, ...props }: any) {
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
            <code
              {...props}
              className={
                className
                  ? `${className} bg-surface-container-highest border-2 border-primary rounded-sm px-1.5 py-0.5 font-mono text-[0.9em] text-primary`
                  : 'bg-surface-container-highest border-2 border-primary rounded-sm px-1.5 py-0.5 font-mono text-[0.9em] text-primary'
              }
            >
              {children}
            </code>
          );
        },
      }}
    >
      {preprocessMarkdown(content)}
    </ReactMarkdown>
  );
};

