import { useEffect, useRef, useState, useMemo } from 'react';
import type { PdfAnnotation } from '../api/client';
import { PdfAnnotationLayer } from './PdfAnnotationLayer';

import {
  PdfLoader,
  PdfHighlighter,
} from 'react-pdf-highlighter';
import type { ScaledPosition } from 'react-pdf-highlighter';
import 'react-pdf-highlighter/dist/style.css';

const workerUrl = '/pdf.worker.min.mjs';

export interface PdfSelection {
  text: string;
  pageNumber: number;
  position: ScaledPosition;
}

interface PdfViewerProps {
  url: string;
  scrollCommand?: { page: number; ts: number };
  annotations?: PdfAnnotation[];
  onLoadSuccess?: (numPages: number) => void;
  onPageVisible?: (pageNumber: number) => void;
  renderSelectionOverlay?: (selection: PdfSelection, cancelSelection: () => void) => React.ReactNode;
  onDeleteAnnotation?: (id: number) => void;
  onUpdateAnnotation?: (id: number, content: string) => void;
  theme?: 'light' | 'dark';
}

let globalIsMouseDown = false;
if (typeof window !== 'undefined') {
  window.addEventListener('mousedown', () => { globalIsMouseDown = true; });
  window.addEventListener('mouseup', () => { globalIsMouseDown = false; });
}

const DelayedSelectionOverlay = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(!globalIsMouseDown);

  useEffect(() => {
    if (isReady) return;

    const handleMouseUp = () => setIsReady(true);
    window.addEventListener('mouseup', handleMouseUp);
    // Safety fallback
    const timer = setTimeout(() => setIsReady(true), 1500);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      clearTimeout(timer);
    };
  }, [isReady]);

  if (!isReady) return null;
  return <>{children}</>;
};

export function PdfViewer({
  url,
  scrollCommand,
  annotations = [],
  onLoadSuccess,
  onPageVisible,
  renderSelectionOverlay,
  onDeleteAnnotation,
  onUpdateAnnotation,
  theme = 'dark'
}: PdfViewerProps) {
  const scrollViewerTo = useRef<((highlight: any) => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const reportedNumPagesRef = useRef<number | null>(null);

  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`[PdfViewer] Render count: ${renderCount.current}, viewerReady: ${viewerReady}, scrollCommand:`, scrollCommand);

  useEffect(() => {
    console.log(`[PdfViewer] Mounted. width: ${containerRef.current?.clientWidth}, height: ${containerRef.current?.clientHeight}`);
    return () => console.log("[PdfViewer] Unmounted");
  }, []);

  const handleSelectionFinished = (
    position: ScaledPosition,
    content: { text?: string; image?: string },
    hideTipAndSelection: () => void,
    transformSelection: () => void
  ) => {
    if (!content.text) return null;
    const selection = { text: content.text, pageNumber: position.pageNumber, position };
    if (renderSelectionOverlay) {
      return (
        <DelayedSelectionOverlay>
          {renderSelectionOverlay(selection, hideTipAndSelection)}
        </DelayedSelectionOverlay>
      );
    }
    return null;
  };

  const formattedHighlights = useMemo(() => {
    return annotations.map(a => {
      let position: ScaledPosition | null = null;
      try {
        const parsed = JSON.parse(a.rect_json);
        if (parsed.boundingRect && parsed.rects && parsed.boundingRect.x1 !== undefined) {
          position = parsed;
        } else {
          position = {
            boundingRect: {
              x1: parsed.x, y1: parsed.y, x2: parsed.x + 100, y2: parsed.y + 20,
              width: parsed.width, height: parsed.height,
              pageNumber: parsed.pageNumber || a.page_number
            },
            rects: parsed.rects ? parsed.rects.map((r: any) => ({
              x1: r.x, y1: r.y, x2: r.x + 100, y2: r.y + 20,
              width: r.width, height: r.height,
              pageNumber: parsed.pageNumber || a.page_number
            })) : [],
            pageNumber: parsed.pageNumber || a.page_number
          };
        }
      } catch (e) {}
      return {
        id: a.id.toString(),
        content: { text: a.selected_text },
        position: position,
        comment: { text: "", emoji: "" },
        rawAnnotation: a
      };
    }).filter(h => h.position !== null);
  }, [annotations]);

  const lastReportedPageRef = useRef<number>(-1);

  // --- TOC sync (page visibility) ---
  useEffect(() => {
    if (!onPageVisible || !containerRef.current) return;
    const visiblePages = new Map<number, number>();

    const observer = new IntersectionObserver((entries) => {
      let changed = false;
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1', 10);
        if (entry.isIntersecting) visiblePages.set(pageNum, entry.intersectionRatio);
        else visiblePages.delete(pageNum);
        changed = true;
      });
      if (changed && visiblePages.size > 0) {
        let bestPage = -1, maxRatio = -1;
        for (const [pageNum, ratio] of visiblePages.entries()) {
          if (ratio > maxRatio) { maxRatio = ratio; bestPage = pageNum; }
        }
        if (bestPage > 0 && bestPage !== lastReportedPageRef.current) {
          lastReportedPageRef.current = bestPage;
          onPageVisible(bestPage);
        }
      }
    }, {
      root: containerRef.current,
      threshold: [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0]
    });

    const mutationObserver = new MutationObserver(() => {
      if (containerRef.current) {
        containerRef.current.querySelectorAll('.page').forEach(p => observer.observe(p));
      }
    });
    mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
    containerRef.current.querySelectorAll('.page').forEach(p => observer.observe(p));

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [onPageVisible]);

  // --- DIAGNOSTIC: secondary readiness signal, independent of scrollRef ---
  // If scrollRef genuinely never fires (worker failure, event-bus timing,
  // version mismatch, etc.) this MutationObserver-based check gives us a
  // second path to readiness AND tells us, via the logs, whether scrollRef
  // fired at all.
  useEffect(() => {
    if (!containerRef.current || viewerReady) return;
    const check = () => {
      const hasPages = !!containerRef.current?.querySelector('.page');
      if (hasPages) {
        console.log(`[PdfViewer] Fallback readiness: .page elements exist in DOM. width: ${containerRef.current?.clientWidth}, height: ${containerRef.current?.clientHeight}. viewerReady was still false. scrollRef may not have fired.`);
      }
    };
    const mo = new MutationObserver(check);
    mo.observe(containerRef.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [viewerReady]);

  // --- Scroll on command ---
  useEffect(() => {
    console.log(`[PdfViewer] scroll effect fired. Reason: dependencies changed [scrollCommand, viewerReady]. scrollCommand:`, scrollCommand, `viewerReady:`, viewerReady);
    console.log('[PdfViewer] scroll effect run:', {
      scrollCommand,
      viewerReady,
      hasScrollFn: !!scrollViewerTo.current
    });

    if (!scrollCommand) return;

    if (!viewerReady || !scrollViewerTo.current) {
      console.log('[PdfViewer] Scroll requested but viewer not ready yet. Deferring until ready.');
      return;
    }

    doScroll(scrollCommand.page);

    function doScroll(page: number) {
      const targetPage = Math.max(1, page);
      console.log('[PdfViewer] Calling scrollViewerTo with targetPage:', targetPage);
      try {
        scrollViewerTo.current!({
          id: 'scroll-cmd',
          position: {
            boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1, pageNumber: targetPage },
            rects: [],
            pageNumber: targetPage
          },
          content: { text: '' },
          comment: { text: '', emoji: '' }
        } as any);
      } catch (e) {
        console.error('[PdfViewer] scrollViewerTo threw:', e);
      }

      const scrollContainer = containerRef.current?.querySelector('.PdfHighlighter__scroll-container') || containerRef.current?.firstElementChild;
      console.log(`[PdfViewer] scrollTop after scroll: ${scrollContainer?.scrollTop ?? 'N/A'}`);
    }
  }, [scrollCommand, viewerReady]);

  return (
    <div
      className={`w-full h-full bg-zinc-950 relative pdf-highlighter-container overflow-hidden theme-${theme}`}
      ref={containerRef}
    >
      <style>{`
        /* Elevate HighlightLayer above textLayer to ensure clicks register on highlights */
        .PdfHighlighter .HighlightLayer {
          z-index: 10 !important;
        }
        /* Ensure textLayer stays below but still enables text selection */
        .PdfHighlighter .textLayer {
          z-index: 2 !important;
        }
      `}</style>
      <PdfLoader
        url={url}
        workerSrc={workerUrl}
        beforeLoad={<div className="p-4 text-zinc-400 flex items-center justify-center h-full w-full">Loading PDF...</div>}
        onError={(error) => {
          console.error("[PdfViewer] PdfLoader error:", error);
          return <div className="p-4 text-red-400 flex items-center justify-center h-full w-full">Error Loading PDF: {error.message}</div>;
        }}
      >
        {(pdfDocument) => {
          console.log('[PdfViewer] PdfLoader render-prop called. numPages:', pdfDocument.numPages);
          if (onLoadSuccess && reportedNumPagesRef.current !== pdfDocument.numPages) {
            reportedNumPagesRef.current = pdfDocument.numPages;
            setTimeout(() => onLoadSuccess(pdfDocument.numPages), 0);
          }

          return (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              enableAreaSelection={(event) => event.altKey}
              onScrollChange={() => {}}
              scrollRef={(scrollTo) => {
                console.log('[PdfViewer] scrollRef callback fired — viewer is ready.');
                scrollViewerTo.current = scrollTo;
                setViewerReady(true);
              }}
              onSelectionFinished={handleSelectionFinished}
              highlightTransform={(highlight: any, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => (
                <PdfAnnotationLayer
                  key={highlight.id}
                  annotation={highlight.rawAnnotation}
                  highlightPosition={highlight.position}
                  onDelete={onDeleteAnnotation}
                  onUpdate={onUpdateAnnotation}
                />
              )}
              highlights={formattedHighlights as any}
            />
          );
        }}
      </PdfLoader>
    </div>
  );
}