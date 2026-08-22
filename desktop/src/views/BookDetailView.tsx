import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDispatch, useSelector } from 'react-redux';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { RootState } from '../store';
import {
  setActiveTopicId,
  setIsPdfDrawerOpen,
  setIsCardGenModalOpen,
  setIsNotesOpen,
  setActiveTopicCards,
  setSearchQuery,
  setPdfTheme
} from '../store/readerSlice';
import { client, type Book, type Topic, type Flashcard, type PdfAnnotation } from '../api/client';
import { Loader2, Zap, PenTool, Link2, BrainCircuit, Play, FileText, ChevronRight, ChevronLeft, CheckCircle2, Circle, Clock, Check, X, Edit2, Trash2, BookOpen, ArrowLeft, LayoutList, ChevronDown, Search, Save, Sun, Moon } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import clsx from 'clsx';
import { FlashcardGenModal } from '../components/FlashcardGenModal';
import { RelatedTopicsModal } from '../components/RelatedTopicsModal';
const NotionNotesEditor = lazy(() => import('../components/NotionNotesEditor').then(m => ({ default: m.NotionNotesEditor })));
import { TopicPracticeModal } from '../components/TopicPracticeModal';
const PdfViewer = lazy(() => import('../components/PdfViewer').then(m => ({ default: m.PdfViewer })));
import type { PdfSelection } from '../components/PdfViewer';
import { PdfCommandPalette, type PdfCommandType } from '../components/PdfCommandPalette';
import { preprocessMarkdown } from '../utils/markdown';
import { SocraticDrillWidget } from '../components/SocraticDrillWidget';
import { loadSettings, saveSetting, saveSettingsStore } from '../api/settingsStore';

export function BookDetailView() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || '0', 10);
  const dispatch = useDispatch();

  const {
    activeTopicId,
    searchQuery,
    isPdfDrawerOpen,
    isNotesOpen,
    activeTopicCards,
    pdfTheme
  } = useSelector((state: RootState) => state.reader);

  // Resizable TOC sidebar state
  const [isTocCollapsed, setIsTocCollapsed] = useState(false);
  const [tocWidth, setTocWidth] = useState(320); // default 320px (80 * 4);
  const [isResizing, setIsResizing] = useState(false);
  const MIN_TOC_WIDTH = 240; // min 240px (60 * 4)
  const MAX_TOC_WIDTH = 480; // max 480px (120 * 4)

  const [book, setBook] = useState<Book | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(new Set());
  const [isRelatedModalOpen, setIsRelatedModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [pdfNumPages, setPdfNumPages] = useState<number>(1);
  const [processingProgress, setProcessingProgress] = useState<{ stage: string, progress?: number, section_count?: number } | null>(null);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [isSavingCard, setIsSavingCard] = useState(false);

  // PDF Annotation state
  const [viewMode, setViewMode] = useState<'topics' | 'pdf'>('topics');
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [isAnnotationLoading, setIsAnnotationLoading] = useState(false);
  const [pdfScrollCommand, setPdfScrollCommand] = useState<{ page: number, ts: number } | undefined>();
  // pdfTheme is now globally managed by Redux and initialized in App.tsx

  const togglePdfTheme = async () => {
    const newTheme = pdfTheme === 'dark' ? 'light' : 'dark';
    dispatch(setPdfTheme(newTheme));
    await saveSetting('pdfTheme', newTheme);
    await saveSettingsStore();
  };

  // Ref to track if activeTopicId change was triggered by scrolling
  const isScrollingRef = useRef(false);

  const listRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
    const handleMouseMove = (e: MouseEvent) => {
      const tocContainer = document.getElementById('toc-sidebar');
      const leftOffset = tocContainer ? tocContainer.getBoundingClientRect().left : 0;
      const newWidth = Math.min(Math.max(e.clientX - leftOffset, MIN_TOC_WIDTH), MAX_TOC_WIDTH);
      setTocWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    if (!bookId) return;
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookData, topicsData, annotationsData] = await Promise.all([
          client.getBook(bookId),
          client.getTopics(bookId),
          client.getAnnotations(bookId)
        ]);
        if (active) {
          setBook(bookData);
          setTopics(topicsData);
          setAnnotations(annotationsData);
        }
      } catch (err) {
        console.error(err);
        if (active) setError("Failed to load book details.");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [bookId]);

  useEffect(() => {
    if (activeTopicId) {
      client.getTopicFlashcards(activeTopicId)
        .then(cards => dispatch(setActiveTopicCards(cards)))
        .catch(console.error);
    } else {
      dispatch(setActiveTopicCards([]));
    }
    // Reset edit state when topic changes
    setEditingCardId(null);
  }, [activeTopicId, dispatch]);

  const handleStartEdit = (card: Flashcard) => {
    setEditingCardId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
  };

  const handleSaveCard = async (id: number) => {
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    setIsSavingCard(true);
    try {
      await client.updateFlashcard(id, { question: editQuestion.trim(), answer: editAnswer.trim() });
      const updatedCards = await client.getTopicFlashcards(activeTopicId!);
      dispatch(setActiveTopicCards(updatedCards));
      setEditingCardId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to update flashcard");
    } finally {
      setIsSavingCard(false);
    }
  };

  const toggleCollapse = (topicId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const { activeProvider } = useSelector((state: RootState) => state.providers);

  const handleProcessTopic = async () => {
    if (!activeTopicId) return;

    // Optimistically update status to processing
    setTopics(prev => prev.map(t => t.id === activeTopicId ? { ...t, status: 'processing' } : t));

    try {
      if (!activeTopic) return;
      setProcessingProgress({ stage: 'starting' });
      await client.processTopicStream(activeTopicId, activeProvider, (event) => {
        setProcessingProgress(event);
      });
      setProcessingProgress(null);

      // Refresh topic and flashcards
      const updatedTopics = await client.getTopics(bookId);
      setTopics(updatedTopics);

      const cards = await client.getTopicFlashcards(activeTopicId);
      dispatch(setActiveTopicCards(cards));

    } catch (err) {
      console.error(err);
      alert("Failed to process topic: " + (err instanceof Error ? err.message : JSON.stringify(err)));
      setProcessingProgress(null);
      // Revert status
      setTopics(prev => prev.map(t => t.id === activeTopicId ? { ...t, status: 'unprocessed' } : t));
    }
  };

  const filteredTopics = useMemo(() => {
    // 1. Build tree to ensure parent-child ordering regardless of DB sort_order
    type TreeNode = Topic & { children: TreeNode[] };
    const topicMap = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    // Initialize map
    for (const t of topics) {
      topicMap.set(t.id, { ...t, children: [] });
    }

    // Build hierarchy
    for (const t of topics) {
      const node = topicMap.get(t.id)!;
      if (t.parent_id && topicMap.has(t.parent_id)) {
        topicMap.get(t.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // 2. Flatten depth-first
    const flattened: Topic[] = [];
    const dfs = (node: TreeNode) => {
      flattened.push(node);
      // Sort children by id to maintain insertion order (or sort_order if available)
      node.children.sort((a, b) => a.id - b.id);
      for (const child of node.children) {
        dfs(child);
      }
    };
    for (const root of roots) {
      dfs(root);
    }

    let result = flattened;

    // 3. Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(query));
    } else {
      // Apply collapse logic only when not searching
      const hiddenParents = new Set<number>();
      for (const t of result) {
        if (collapsedParents.has(t.id)) {
          hiddenParents.add(t.id);
        }
      }

      result = result.filter(t => {
        if (t.parent_id && hiddenParents.has(t.parent_id)) {
          hiddenParents.add(t.id); // Cascade hide
          return false;
        }
        return true;
      });
    }

    return result;
  }, [topics, searchQuery, collapsedParents]);

  const rowVirtualizer = useVirtualizer({
    count: filteredTopics.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  const activeTopic = topics.find(t => t.id === activeTopicId);

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm("Delete this flashcard?")) return;
    try {
      await client.deleteFlashcard(cardId);
      dispatch(setActiveTopicCards(activeTopicCards.filter(c => c.id !== cardId)));
    } catch (e) {
      console.error(e);
      alert("Failed to delete card");
    }
  };

  const handlePdfPageVisible = useCallback((pageNumber: number) => {
    if (!topics.length) return;

    // Find the topic that owns this page. When multiple topics tie on
    // start_page (e.g. a subtopic starts on the same page as its parent),
    // prefer the deepest / most specific one rather than whichever
    // happens to appear first in the topics array.
    let bestTopic: Topic | null = null;

    for (const t of topics) {
      const startPage = Number(t.start_page);
      if (isNaN(startPage) || startPage > pageNumber) continue;

      if (!bestTopic) {
        bestTopic = t;
        continue;
      }

      const bestStart = Number(bestTopic.start_page);
      if (startPage > bestStart) {
        bestTopic = t;
      } else if (startPage === bestStart && (t.level ?? 0) > (bestTopic.level ?? 0)) {
        // tie on start_page -> prefer the more deeply nested topic
        bestTopic = t;
      }
    }

    if (bestTopic && bestTopic.id !== activeTopicId) {
      isScrollingRef.current = true;
      dispatch(setActiveTopicId(bestTopic.id));

      if (bestTopic.parent_id) {
        setCollapsedParents(prev => {
          const next = new Set(prev);
          let currentParentId: number | null | undefined = bestTopic!.parent_id;
          let changed = false;
          while (currentParentId) {
            if (next.has(currentParentId)) {
              next.delete(currentParentId);
              changed = true;
            }
            const parentTopic = topics.find(t => t.id === currentParentId);
            currentParentId = parentTopic ? parentTopic.parent_id : null;
          }
          return changed ? next : prev;
        });
      }
    }
  }, [topics, activeTopicId, dispatch]);

  // Effect to scroll the TOC when activeTopicId changes (from PDF scrolling)
  useEffect(() => {
    if (isScrollingRef.current && activeTopicId) {
      isScrollingRef.current = false;
      const index = filteredTopics.findIndex(t => t.id === activeTopicId);
      if (index !== -1) {
        // Small timeout to allow DOM/Virtualizer to update if parents were just uncollapsed
        setTimeout(() => {
          rowVirtualizer.scrollToIndex(index, { align: 'center' });
        }, 50);
      }
    }
  }, [activeTopicId, filteredTopics, rowVirtualizer]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-surface"><Loader2 className="animate-spin text-accent-blue w-8 h-8" /></div>;
  }

  if (error || !book) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface">
        <p className="text-red-400 mb-4 font-medium">{error || "Book not found."}</p>
        <Link to="/" className="text-accent-blue hover:text-accent-blue inline-flex items-center gap-2 bg-active-bg px-4 py-2 rounded-lg">
          <ArrowLeft size={16} /> Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-surface h-full w-full relative">

      {/* Left Sidebar: TOC - Resizable */}
      <div 
        id="toc-sidebar"
        className={clsx(
          "shrink-0 min-w-0 border-r-[3px] border-on-background bg-surface-container-low flex flex-col z-10 relative overflow-hidden transition-[width] duration-200 ease-out",
          isTocCollapsed && "border-r-0"
        )}
        style={{ width: isTocCollapsed ? 0 : `${tocWidth}px` }}
      >
        <div className="p-4 border-b-[3px] border-on-background bg-surface-container-lowest flex flex-col gap-3 min-w-[240px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-on-surface hover:text-primary p-1.5 rounded-md hover:bg-surface-container transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <div className="text-sm font-semibold text-primary truncate">
                {book.title}
              </div>
            </div>
            <button
              onClick={() => setIsTocCollapsed(true)}
              className="text-on-surface hover:text-primary p-1 rounded hover:bg-surface-container transition-colors shrink-0"
              title="Collapse Outline"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Filter topics..."
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              className="w-full bg-surface border-[3px] border-on-background py-2 pl-10 pr-3 text-label-md font-label-md text-primary placeholder:text-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            />
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto">
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const topic = filteredTopics[virtualRow.index];
              const isSelected = activeTopicId === topic.id;
              const hasChildren = topics.some(t => t.parent_id === topic.id);
              const isCollapsed = collapsedParents.has(topic.id);

              return (
                <button
                  key={virtualRow.key}
                  onClick={() => {
                    dispatch(setActiveTopicId(topic.id));
                    setPdfScrollCommand({ page: topic.start_page, ts: Date.now() });
                    setViewMode('topics');
                  }}
                  className={clsx(
                    "absolute top-0 left-0 w-full flex items-center text-left transition-colors border-b-[3px] border-on-background group",
                    isSelected 
                      ? "bg-primary-container text-on-primary-container neo-shadow-sm z-10" 
                      : "text-on-surface hover:bg-surface-container hover:text-primary"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: `${(topic.level - 1) * 1.5 + 1}rem`,
                    paddingRight: '1rem'
                  }}
                >
                  {hasChildren ? (
                    <div
                      className="shrink-0 p-1 mr-1 rounded hover:bg-surface-container-high text-on-surface-variant"
                      onClick={(e) => toggleCollapse(topic.id, e)}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </div>
                  ) : (
                    <div className="w-6 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="truncate text-sm font-medium">{topic.title}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {topic.mastery_status === 'mastered' ? (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" title="Mastered" />
                    ) : topic.mastery_status === 'developing' ? (
                      <div className="w-2 h-2 rounded-full bg-amber-500" title="Developing" />
                    ) : topic.mastery_status === 'fragile' ? (
                      <div className="w-2 h-2 rounded-full bg-orange-500" title="Fragile" />
                    ) : topic.mastery_status === 'misconception' ? (
                      <div className="w-2 h-2 rounded-full bg-red-500" title="Misconception" />
                    ) : topic.status === 'processing' ? (
                      <Loader2 size={12} className="animate-spin text-amber-500" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-on-background" title="Untested" />
                    )}
                    <div className="text-[10px] font-bold text-on-surface-variant bg-surface px-2 py-0.5 border-2 border-on-background">p. {topic.start_page}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      {!isTocCollapsed && (
        <div
          className={clsx(
            "w-1 cursor-col-resize hover:bg-accent-blue/50 active:bg-accent-blue transition-colors duration-150 relative z-20",
            isResizing && "bg-accent-blue"
          )}
          onMouseDown={handleMouseDown}
          style={{ flexShrink: 0 }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex relative bg-surface overflow-hidden">
        {!activeTopic ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
            <LayoutList size={48} className="mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-primary mb-2">Topic Workspace</h3>
            <p className="max-w-md text-sm">Select a topic from the left sidebar to start studying. Generate flashcards, take notes, and view related concepts.</p>
          </div>
        ) : (
          <>
            <div 
              className={clsx(
                "flex flex-col bg-surface",
                viewMode === 'pdf' 
                  ? "flex-1 relative h-full" 
                  : "absolute inset-0 opacity-0 pointer-events-none z-[-1]"
              )}
              inert={viewMode !== 'pdf' ? true : undefined}
            >
              {/* Top Bar for PDF */}
              <div className="h-16 border-b-[3px] border-primary flex items-center justify-between px-4 bg-surface-container-lowest shrink-0 z-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewMode('topics')}
                    className="flex items-center gap-2 px-2 py-1.5 text-on-surface hover:text-zinc-100 hover:bg-surface-container rounded-md transition-colors"
                  >
                    <ArrowLeft size={16} />
                    <span className="text-sm font-medium">Back to Topics</span>
                  </button>
                  <div className="w-px h-4 bg-surface-container-high mx-1"></div>
                  <div className="text-sm font-medium text-primary flex items-center gap-2">
                    <FileText size={16} className="text-accent-blue shrink-0" />
                    <span className="truncate max-w-[200px]">{book?.title || 'Source PDF'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePdfTheme}
                    className="p-1.5 text-on-surface hover:text-primary hover:bg-surface-container rounded-md transition-colors"
                    title={`Switch to ${pdfTheme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {pdfTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                  {annotations.length > 0 && (
                    <button
                      onClick={() => window.open(`http://127.0.0.1:8000/books/${bookId}/export-annotated`, '_blank')}
                      className="text-label-sm font-bold text-primary bg-tertiary-fixed px-3 py-1.5 transition-colors border-[3px] border-primary neo-shadow-sm active-neo-press"
                    >
                      Export PDF
                    </button>
                  )}
                  <div className="text-xs text-on-surface-variant">
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 relative">
                <ErrorBoundary>
                  <Suspense fallback={<div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin text-accent-blue w-8 h-8 mb-4" /><p className="text-sm font-medium text-on-surface-variant">Loading PDF Viewer...</p></div>}>
                  <PdfViewer
                    theme={pdfTheme}
                    url={`http://127.0.0.1:8000/books/${bookId}/pdf`}
                    scrollCommand={pdfScrollCommand}
                    annotations={annotations}
                    onLoadSuccess={(num) => {
                      setPdfNumPages(num);
                    }}
                    onPageVisible={handlePdfPageVisible}
                    renderSelectionOverlay={(sel, cancelSelection) => (
                      <PdfCommandPalette
                        selection={sel}
                        position={{ x: 0, y: 0 }}
                        onDismiss={() => {
                          cancelSelection();
                        }}
                        onCommand={async (type, options) => {
                          const rectJson = JSON.stringify(sel.position);
                          setIsAnnotationLoading(true);
                          try {
                            if (type === 'add_sidenote') {
                              await client.createAnnotation(bookId, {
                                page_number: sel.pageNumber,
                                annotation_type: 'sidenote',
                                selected_text: sel.text,
                                rect_json: rectJson,
                                content: options?.note || '',
                              });
                            } else if (type === 'explain_ai') {
                              if (options?.pin_content) {
                                await client.createAnnotation(bookId, {
                                  page_number: sel.pageNumber,
                                  annotation_type: 'ai_explanation',
                                  selected_text: sel.text,
                                  rect_json: rectJson,
                                  content: options.pin_content,
                                  custom_prompt: options?.prompt,
                                });
                              } else {
                                const res = await client.explainText(bookId, {
                                  selected_text: sel.text,
                                  custom_prompt: options?.prompt,
                                  page_number: sel.pageNumber,
                                  rect_json: rectJson,
                                  save: !options?.preview,
                                  provider_override: activeProvider,
                                });
                                if (options?.preview) return res;
                              }
                            } else if (type === 'generate_flashcards') {
                              if (options?.pin_content) {
                                await client.createAnnotation(bookId, {
                                  page_number: sel.pageNumber,
                                  annotation_type: 'flashcard_link',
                                  selected_text: sel.text,
                                  rect_json: rectJson,
                                  content: options.pin_content,
                                  custom_prompt: options?.prompt,
                                });
                              } else {
                                const res = await client.generateFlashcardsFromSelection(bookId, {
                                  selected_text: sel.text,
                                  custom_prompt: options?.prompt,
                                  count: options?.count || 5,
                                  page_number: sel.pageNumber,
                                  rect_json: rectJson,
                                  save: !options?.preview,
                                  provider_override: activeProvider,
                                });
                                if (options?.preview) return res;
                              }
                            }

                            // Refresh annotations if we actually saved
                            if (!options?.preview) {
                              cancelSelection();
                              const updated = await client.getAnnotations(bookId);
                              setAnnotations(updated);
                            }
                          } catch (err) {
                            console.error(`Annotation command '${type}' failed:`, err);
                          } finally {
                            setIsAnnotationLoading(false);
                          }
                        }}
                      />
                    )}
                    onDeleteAnnotation={async (id) => {
                      try {
                        await client.deleteAnnotation(id);
                        const updated = await client.getAnnotations(bookId);
                        setAnnotations(updated);
                      } catch (e) {
                        console.error("Failed to delete annotation:", e);
                      }
                    }}
                    onUpdateAnnotation={async (id, content) => {
                      try {
                        await client.updateAnnotation(id, content);
                        const updated = await client.getAnnotations(bookId);
                        setAnnotations(updated);
                      } catch (e) {
                        console.error("Failed to update annotation:", e);
                      }
                    }}
                  />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
            <div className={clsx("flex-1 flex flex-col h-full overflow-y-auto", viewMode !== 'topics' && "hidden")}>
              {/* Header & Quick Actions */}
              <div className="p-6 border-b-[3px] border-primary bg-surface-container-lowest shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10 relative">
                <div className="flex items-center gap-2 text-xs text-accent-blue font-medium font-medium mb-3">
                  {isTocCollapsed && (
                    <button 
                      onClick={() => setIsTocCollapsed(false)}
                      className="text-accent-blue hover:text-accent-blue/80 transition-colors p-1 rounded hover:bg-surface-container -ml-1 mr-1"
                      title="Show Outline"
                    >
                      <LayoutList size={16} />
                    </button>
                  )}
                  <Link to="/" className="hover:text-accent-blue transition-colors">{book.title}</Link>
                  <span>/</span>
                  <span>{activeTopic.breadcrumb || 'Chapter'}</span>
                </div>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <h1 className="font-headline-lg text-headline-lg font-black text-primary leading-tight">
                    {activeTopic.title}
                  </h1>
                  <div className="shrink-0 text-label-sm font-label-sm font-bold text-on-surface-variant bg-surface-container px-3 py-1 border-[3px] border-primary neo-shadow-sm">
                    Target: p. {activeTopic.start_page}
                  </div>
                </div>

                <div className="mb-6">
                  <SocraticDrillWidget
                    topicId={activeTopic.id}
                    topicTitle={activeTopic.title}
                    onMasteryUpdate={(score, status) => {
                      // Refresh topics to update TOC mastery indicators
                      client.getTopics(bookId).then(setTopics).catch(console.error);
                    }}
                  />
                </div>

                {/* Quick Actions Bar */}
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => {
                      setViewMode('pdf');
                      setPdfScrollCommand({ page: activeTopic.start_page, ts: Date.now() });
                    }}
                    className="flex items-center gap-2 px-6 py-3 text-label-md font-bold transition-all border-[3px] border-primary bg-surface-container-lowest text-primary neo-shadow-sm active-neo-press"
                  >
                    <FileText size={18} /> View PDF
                  </button>
                  <button
                    onClick={() => dispatch(setIsCardGenModalOpen(true))}
                    className="flex items-center gap-2 px-6 py-3 text-label-md font-bold transition-all bg-surface-container-lowest text-primary border-[3px] border-primary neo-shadow-sm active-neo-press"
                  >
                    <Zap size={18} style={{ fontVariationSettings: "'FILL' 1" }} /> Generate Flashcards
                  </button>
                  <button
                    onClick={() => dispatch(setIsNotesOpen(!isNotesOpen))}
                    className={clsx(
                      "flex items-center gap-2 px-6 py-3 text-label-md font-bold transition-all border-[3px] border-primary neo-shadow-sm active-neo-press",
                      isNotesOpen ? "bg-amber-500 text-zinc-950" : "bg-surface-container-lowest text-primary"
                    )}
                  >
                    <PenTool size={18} /> Study Notes
                  </button>
                  <button
                    onClick={() => setIsRelatedModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 text-label-md font-bold bg-surface-container-lowest text-primary border-[3px] border-primary neo-shadow-sm active-neo-press ml-auto"
                  >
                    <Link2 size={18} /> Related
                  </button>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-6 flex-1 min-h-0">

                {/* Generated Topic Data (if processed) */}
                {activeTopic.status === 'processed' && (activeTopic.summary || activeTopic.concept_type) && (
                  <div className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 border-[3px] border-on-background bg-surface-container-lowest flex items-center justify-center neo-shadow-sm text-primary">
                        <BrainCircuit size={20} />
                      </div>
                      <div>
                        <h3 className="font-headline-md text-headline-md font-bold text-primary">AI Topic Summary</h3>
                        {activeTopic.concept_type && (
                          <p className="text-label-sm font-label-sm font-bold uppercase tracking-wider text-secondary">{activeTopic.concept_type}</p>
                        )}
                      </div>
                    </div>
                    {activeTopic.summary && (
                      <div className="text-sm text-primary leading-relaxed mb-4 font-serif prose prose-slate max-w-none">
                        <MarkdownRenderer content={activeTopic.summary} />
                      </div>
                    )}
                    {activeTopic.key_terms && activeTopic.key_terms !== "[]" && (
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          try {
                            const terms = JSON.parse(activeTopic.key_terms);
                            return terms.map((term: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 bg-surface-container text-primary font-bold text-label-sm uppercase border-[3px] border-primary neo-shadow-sm">
                                {term}
                              </span>
                            ));
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}


                {/* Flashcards List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-md text-headline-md font-black uppercase tracking-wider flex items-center gap-3">
                      <span>Topic Flashcards</span>
                      <span className="bg-primary text-white border-[3px] border-primary px-3 py-1 text-label-md font-black neo-shadow-sm">{activeTopicCards.length}</span>
                    </h3>
                    {activeTopicCards.length > 0 && (
                      <button
                        onClick={() => setIsPracticeModalOpen(true)}
                        className="text-label-md font-black bg-secondary text-white border-[3px] border-primary px-6 py-2 neo-shadow-sm active-neo-press transition-all flex items-center gap-2"
                      >
                        <Play size={16} style={{ fontVariationSettings: "'FILL' 1" }} /> Practice
                      </button>
                    )}
                  </div>

                  {activeTopicCards.length === 0 ? (
                    <div className="p-8 border-[3px] border-dashed border-primary flex flex-col items-center justify-center text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors min-h-[200px]">
                      <Zap size={32} className="mb-4 text-primary" />
                      <p className="font-label-lg text-label-lg font-bold">No flashcards generated yet.</p>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {activeTopicCards.map(card => (
                        <div key={card.id} className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow p-6 group relative hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                          {editingCardId === card.id ? (
                            <div className="space-y-4">
                              <div>
                                <div className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Question</div>
                                <textarea
                                  value={editQuestion}
                                  onChange={(e) => setEditQuestion(e.target.value)}
                                  className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue/50 focus:border-accent-blue/50 resize-y min-h-[60px]"
                                />
                              </div>
                              <div>
                                <div className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Answer</div>
                                <textarea
                                  value={editAnswer}
                                  onChange={(e) => setEditAnswer(e.target.value)}
                                  className="w-full bg-surface border-[3px] border-on-background p-3 text-label-md font-label-md text-primary placeholder:text-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all resize-y min-h-[100px]"
                                />
                              </div>
                              <div className="flex justify-end gap-3 pt-2">
                                <button
                                  onClick={() => setEditingCardId(null)}
                                  className="px-4 py-2 text-label-md font-bold text-on-surface-variant hover:text-primary transition-colors border-[3px] border-transparent hover:border-on-background"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveCard(card.id)}
                                  className="px-6 py-2 bg-primary text-white font-bold border-[3px] border-primary neo-shadow-sm active-neo-press transition-all"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleStartEdit(card)}
                                  className="p-1.5 text-on-surface hover:text-white hover:bg-surface-container-high rounded-md"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md"
                                  onClick={() => handleDeleteCard(card.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="pr-16 space-y-4">
                                <div>
                                  <div className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Question</div>
                                  <div className="font-body-lg text-body-lg text-primary font-medium prose prose-slate max-w-none">
                                    <MarkdownRenderer content={card.question} />
                                  </div>
                                </div>
                                <div className="bg-surface-container-low border-[3px] border-on-background p-4 neo-shadow-sm">
                                  <div className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Answer</div>
                                  <div className="text-body-md font-body-md text-on-surface prose prose-slate max-w-none">
                                    <MarkdownRenderer content={card.answer} />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}


      </div>

      <FlashcardGenModal />
      <RelatedTopicsModal isOpen={isRelatedModalOpen} onClose={() => setIsRelatedModalOpen(false)} />
      {activeTopic && (
        <TopicPracticeModal
          isOpen={isPracticeModalOpen}
          onClose={() => setIsPracticeModalOpen(false)}
          topicId={activeTopic.id}
          topicName={activeTopic.title}
          cards={activeTopicCards}
        />
      )}

      {/* Notes Modal */}
      {isNotesOpen && activeTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant shrink-0 bg-surface/50">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-100">
                <PenTool size={18} className="text-amber-500" /> Study Notes: {activeTopic.title}
              </h2>
              <button
                onClick={() => dispatch(setIsNotesOpen(false))}
                className="text-on-surface hover:text-white p-1.5 rounded-md hover:bg-surface-container transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4 bg-surface">
              <Suspense fallback={<div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin text-accent-blue w-8 h-8 mb-4" /><p className="text-sm font-medium text-on-surface-variant">Loading Editor...</p></div>}>
                <NotionNotesEditor key={activeTopic.id} topicId={activeTopic.id} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
