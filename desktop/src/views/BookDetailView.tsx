import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
import { client, type Book, type Topic, type Flashcard, type PdfAnnotation, type AtomicConcept } from '../api/client';
import { Loader2, Zap, PenTool, Link2, BrainCircuit, Play, FileText, ChevronRight, ChevronLeft, CheckCircle2, Circle, Clock, Check, X, Edit2, Trash2, BookOpen, ArrowLeft, LayoutList, ChevronDown, Search, Save, Sun, Moon, MoreHorizontal, Bot, Copy, Target, Sparkles, Layers, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import clsx from 'clsx';
import { FlashcardGenModal } from '../components/FlashcardGenModal';
import { RelatedTopicsModal } from '../components/RelatedTopicsModal';
import { AIChatSidebar } from '../components/AIChatSidebar';
const NotionNotesEditor = lazy(() => import('../components/NotionNotesEditor').then(m => ({ default: m.NotionNotesEditor })));
import { TopicPracticeModal } from '../components/TopicPracticeModal';
const PdfViewer = lazy(() => import('../components/PdfViewer').then(m => ({ default: m.PdfViewer })));
import type { PdfSelection } from '../components/PdfViewer';
import { PdfCommandPalette, type PdfCommandType } from '../components/PdfCommandPalette';
import { preprocessMarkdown } from '../utils/markdown';
import { SocraticDrillWidget } from '../components/SocraticDrillWidget';
import { loadSettings, saveSetting, saveSettingsStore } from '../api/settingsStore';
import { useToast } from '../hooks/useToast';
import type { ApiError } from '../api/errors';

export function BookDetailView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
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

  const [isChatOpen, setIsChatOpen] = useState(false);

  const [book, setBook] = useState<Book | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(new Set());
  const [isRelatedModalOpen, setIsRelatedModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [pdfNumPages, setPdfNumPages] = useState<number>(1);
  const [processingProgress, setProcessingProgress] = useState<{
    stage?: string;
    status?: string;
    progress?: number;
    section_count?: number;
    child_title?: string;
    child_count?: number;
    current?: number;
    total?: number;
    message?: string;
  } | null>(null);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [selectedDrillConcept, setSelectedDrillConcept] = useState<AtomicConcept | null>(null);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const drillWidgetRef = useRef<HTMLDivElement>(null);

  // PDF Annotation state
  const [activeCardTab, setActiveCardTab] = useState<'cards' | 'notes'>('cards');
  const { showToast } = useToast();
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [isAnnotationLoading, setIsAnnotationLoading] = useState(false);
  const [pdfScrollCommand, setPdfScrollCommand] = useState<{ page: number, ts: number } | undefined>();
  const [viewMode, setViewMode] = useState<'topics' | 'pdf' | 'markdown'>('topics');
  const [isMdCopied, setIsMdCopied] = useState(false);
  const hasInitializedScrollRef = useRef(false);
  // pdfTheme is now globally managed by Redux and initialized in App.tsx

  const togglePdfTheme = async () => {
    const newTheme = pdfTheme === 'dark' ? 'light' : 'dark';
    dispatch(setPdfTheme(newTheme));
    await saveSetting('pdfTheme', newTheme).catch((err) =>
      console.warn('[BookDetail] Failed to save setting:', err)
    );
    // Flush to disk in background — don't block the UI toggle
    saveSettingsStore().catch((err) =>
      console.warn('[BookDetail] Background settings flush error:', err)
    );
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

          const topicParam = searchParams.get('topic');
          if (topicParam) {
            const parsedTopicId = parseInt(topicParam, 10);
            if (!isNaN(parsedTopicId)) {
              dispatch(setActiveTopicId(parsedTopicId));
              const targetTopic = topicsData.find(t => t.id === parsedTopicId);
              if (targetTopic) {
                setPdfScrollCommand({ page: targetTopic.start_page, ts: Date.now() });
              }
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        if (active) {
          setError(err?.userMessage || "Failed to load book details.");
          showToast('error', err?.userMessage || 'Failed to load book details.', err?.debugDetail);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [bookId]);

  const reloadTopics = async () => {
    if (!bookId) return;
    try {
      const data = await client.getTopics(bookId);
      setTopics(data);
    } catch (err) {
      console.error("Failed to reload topics", err);
    }
  };

  useEffect(() => {
    if (activeTopicId) {
      client.getTopicFlashcards(activeTopicId)
        .then(cards => dispatch(setActiveTopicCards(cards)))
        .catch((err: any) => {
          console.error(err);
          showToast('error', err?.userMessage || 'Failed to load flashcards.', err?.debugDetail);
        });
    } else {
      dispatch(setActiveTopicCards([]));
    }
    // Reset edit state when topic changes
    setEditingCardId(null);
    setCurrentCardIndex(0);
    setSelectedDrillConcept(null);
  }, [activeTopicId, dispatch]);

  // Restore PDF scroll position on mount if we already have an active topic
  useEffect(() => {
    if (topics.length > 0 && activeTopicId && !hasInitializedScrollRef.current) {
      const topic = topics.find(t => t.id === activeTopicId);
      if (topic) {
        setPdfScrollCommand({ page: topic.start_page, ts: Date.now() });
      }
      hasInitializedScrollRef.current = true;
    }
  }, [topics, activeTopicId]);

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
    } catch (e: any) {
      console.error(e);
      showToast('error', e?.userMessage || 'Failed to update flashcard.', e?.debugDetail);
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

  const parentTopicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const t of topics) {
      if (t.parent_id) {
        ids.add(t.parent_id);
      }
    }
    return ids;
  }, [topics]);

  const handleCollapseAll = () => {
    setCollapsedParents(new Set(parentTopicIds));
  };

  const handleExpandAll = () => {
    setCollapsedParents(new Set());
  };

  const { activeProvider } = useSelector((state: RootState) => state.providers);

  const handleProcessTopic = async () => {
    if (!activeTopicId) return;

    // Optimistically update status to processing for active topic and any children
    setTopics(prev => prev.map(t => (t.id === activeTopicId || t.parent_id === activeTopicId) ? { ...t, status: 'processing' } : t));

    try {
      if (!activeTopic) return;
      setProcessingProgress({ stage: 'starting' });
      await client.processTopicStream(activeTopicId, activeProvider, (event) => {
        setProcessingProgress(event);
      });
      setProcessingProgress(null);

      // Refresh topics and flashcards
      const updatedTopics = await client.getTopics(bookId);
      setTopics(updatedTopics);

      const cards = await client.getTopicFlashcards(activeTopicId);
      dispatch(setActiveTopicCards(cards));

    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to process topic.', err?.debugDetail);
      setProcessingProgress(null);
      // Revert status from server truth
      const updatedTopics = await client.getTopics(bookId).catch(() => null);
      if (updatedTopics) {
        setTopics(updatedTopics);
      } else {
        setTopics(prev => prev.map(t => (t.id === activeTopicId || t.parent_id === activeTopicId) ? { ...t, status: 'unprocessed' } : t));
      }
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
      // Sort children by sort_order (or id fallback) to maintain book outline order
      node.children.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
      for (const child of node.children) {
        dfs(child);
      }
    };
    roots.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
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
    } catch (e: any) {
      console.error(e);
      showToast('error', e?.userMessage || 'Failed to delete flashcard.', e?.debugDetail);
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
      <aside 
        id="toc-sidebar"
        className={clsx(
          "shrink-0 min-w-0 border-r-2 border-on-surface bg-surface-container-lowest flex flex-col h-[calc(100vh-64px)] sticky top-0 overflow-hidden z-10 transition-[width] duration-200 ease-out",
          isTocCollapsed && "border-r-0"
        )}
        style={{ width: isTocCollapsed ? 0 : `${tocWidth}px` }}
      >
        <div className="h-16 px-4 flex items-center border-b-2 border-on-surface bg-surface-container-lowest shrink-0 min-w-[240px]">
          <span className="font-bold text-2xl text-primary tracking-tight">Recall AI</span>
        </div>
        
        <div className="p-4 border-b border-outline-variant bg-surface-container-lowest shrink-0 min-w-[240px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-on-surface">Topics</h2>
            <div className="flex items-center gap-1 shrink-0">
              {parentTopicIds.size > 0 && (
                <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant/60 p-0.5">
                  <button
                    onClick={handleCollapseAll}
                    className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-surface-container transition-colors shrink-0"
                    title="Auto-collapse all topics"
                    aria-label="Auto-collapse all topics"
                  >
                    <ChevronsDownUp size={15} />
                  </button>
                  <button
                    onClick={handleExpandAll}
                    className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-surface-container transition-colors shrink-0"
                    title="Expand all topics"
                    aria-label="Expand all topics"
                  >
                    <ChevronsUpDown size={15} />
                  </button>
                </div>
              )}
              <button
                onClick={() => setIsTocCollapsed(true)}
                className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-surface-container transition-colors shrink-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              placeholder="Filter topics..."
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
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
                    setIsChatOpen(false);
                    setPdfScrollCommand({ page: topic.start_page, ts: Date.now() });
                    setViewMode('topics');
                  }}
                  className={clsx(
                    "absolute top-0 left-0 w-full flex items-center text-left transition-colors group",
                    isSelected 
                      ? "bg-primary/10 text-primary font-semibold z-10 rounded-md" 
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-md"
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
      </aside>

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

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => dispatch(setIsNotesOpen(!isNotesOpen))}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-on-surface rounded-md transition-all shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]",
                      isNotesOpen ? "bg-amber-500 text-black border-amber-600" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
                    )}
                    title="Toggle Study Notes split screen"
                  >
                    <PenTool size={14} />
                    <span>Notes</span>
                  </button>
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
                      className="text-xs font-semibold text-primary bg-surface-container-low hover:bg-surface-container px-3 py-1.5 transition-colors border border-border-default rounded-md shadow-xs"
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
                            } else if (type === 'send_to_notes') {
                              if (activeTopic) {
                                const quoteContent = options?.note
                                  ? `> "${sel.text}"\n\n*Source: Page ${sel.pageNumber}*\n\n**Note:** ${options.note}`
                                  : `> "${sel.text}"\n\n*Source: Page ${sel.pageNumber}*`;
                                await client.appendNote(activeTopic.id, quoteContent, `Page ${sel.pageNumber} Excerpt`);
                                showToast('success', `Quotation added to Study Notes for "${activeTopic.title}"`);
                                dispatch(setIsNotesOpen(true));
                              } else {
                                showToast('info', 'Please select a topic from outline to attach notes to.');
                              }
                            }

                            // Refresh annotations if we actually saved
                            if (!options?.preview) {
                              cancelSelection();
                              const updated = await client.getAnnotations(bookId);
                              setAnnotations(updated);
                            }
                          } catch (err: any) {
                            console.error(`Annotation command '${type}' failed:`, err);
                            showToast('error', err?.userMessage || `Annotation command failed.`, err?.debugDetail);
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
                      } catch (e: any) {
                        console.error("Failed to delete annotation:", e);
                        showToast('error', e?.userMessage || 'Failed to delete annotation.', e?.debugDetail);
                      }
                    }}
                    onUpdateAnnotation={async (id, content) => {
                      try {
                        await client.updateAnnotation(id, content);
                        const updated = await client.getAnnotations(bookId);
                        setAnnotations(updated);
                      } catch (e: any) {
                        console.error("Failed to update annotation:", e);
                        showToast('error', e?.userMessage || 'Failed to update annotation.', e?.debugDetail);
                      }
                    }}
                  />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
            {/* Markdown Viewer */}
            <div 
              className={clsx(
                "flex flex-col bg-surface",
                viewMode === 'markdown' 
                  ? "flex-1 relative h-full" 
                  : "absolute inset-0 opacity-0 pointer-events-none z-[-1]"
              )}
              inert={viewMode !== 'markdown' ? true : undefined}
            >
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
                    <span className="truncate max-w-[200px]">Extracted Markdown</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => dispatch(setIsNotesOpen(!isNotesOpen))}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-on-surface rounded-md transition-all shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]",
                      isNotesOpen ? "bg-amber-500 text-black border-amber-600" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
                    )}
                    title="Toggle Study Notes split screen"
                  >
                    <PenTool size={14} />
                    <span>Notes</span>
                  </button>
                  {activeTopic?.content_md && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeTopic.content_md || '');
                        setIsMdCopied(true);
                        setTimeout(() => setIsMdCopied(false), 2000);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-on-surface hover:text-primary hover:bg-surface-container rounded-md transition-colors border-2 border-transparent hover:border-primary/20"
                      title="Copy markdown to clipboard"
                    >
                      {isMdCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      <span className={clsx("text-sm font-medium", isMdCopied && "text-green-500")}>
                        {isMdCopied ? "Copied!" : "Copy"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-surface-container custom-scrollbar">
                  <div className="max-w-4xl mx-auto bg-surface-container-lowest p-8 md:p-12 rounded-xl shadow-sm border-2 border-primary prose prose-slate dark:prose-invert prose-p:text-on-surface prose-headings:text-on-surface prose-strong:text-on-surface prose-li:text-on-surface prose-pre:bg-surface prose-table:border-collapse prose-table:w-full prose-th:bg-surface-container-low prose-th:p-3 prose-th:border-2 prose-th:border-primary prose-th:text-on-surface prose-td:p-3 prose-td:border-2 prose-td:border-primary prose-td:text-on-surface">
                  {activeTopic?.content_md ? (
                    <MarkdownRenderer content={activeTopic.content_md} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                      <p>No markdown extracted for this topic.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={clsx("flex-1 flex justify-center h-full overflow-y-auto custom-scrollbar", viewMode !== 'topics' && "hidden")}>
              <div className="w-full max-w-5xl flex flex-col min-h-full">
              {/* Header */}
              <div className="px-5 pt-3 flex items-center justify-between text-sm text-outline">
                <div className="flex items-center gap-1">
                  {isTocCollapsed && (
                    <button 
                      onClick={() => setIsTocCollapsed(false)}
                      className="bg-surface-container-lowest border-2 border-on-surface rounded-md p-1.5 hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-on-surface mr-3 flex items-center justify-center shrink-0 transition-all"
                      title="Show Outline"
                    >
                      <LayoutList size={20} />
                    </button>
                  )}
                  <Link to="/" className="hover:text-primary transition-colors truncate max-w-[200px]">{book.title}</Link>
                  <ChevronRight size={16} />
                  <span className="truncate max-w-[200px]">{activeTopic.breadcrumb || 'Chapter'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-surface-container rounded-full border border-outline-variant font-bold text-on-surface">
                    Target: p. {activeTopic.start_page}
                  </span>
                  {/* <button className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-variant transition-colors border border-outline-variant">
                    <MoreHorizontal size={18} className="text-on-surface" />
                  </button> */}
                </div>
              </div>

              {processingProgress && (
                <div className="px-5 mt-2 mb-2">
                  <div className="bg-amber-500/10 border-2 border-amber-500 text-amber-700 px-4 py-3 rounded-xl shadow-[4px_4px_0px_0px_var(--color-amber-500)] flex items-center gap-3">
                    <Loader2 className="animate-spin shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">
                        {processingProgress.stage === 'processing_child'
                          ? `Extracting Subtopic ${processingProgress.current || 1} of ${processingProgress.total || 1}...`
                          : (processingProgress.stage === 'parent_decomposition'
                            ? 'Decomposing Chapter into Subtopics...'
                            : 'Processing Topic...')}
                      </h4>
                      <p className="text-xs font-medium opacity-80 mt-0.5 truncate">
                        {processingProgress.child_title
                          ? processingProgress.child_title
                          : (processingProgress.message || (processingProgress.stage || processingProgress.status || 'processing').replace(/_/g, ' '))}
                        {processingProgress.progress !== undefined ? ` (${processingProgress.progress}%)` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={drillWidgetRef} className="px-5 mt-2">
                <SocraticDrillWidget
                  topicId={activeTopic.id}
                  topicTitle={activeTopic.title}
                  targetConcept={selectedDrillConcept}
                  onClearTargetConcept={() => setSelectedDrillConcept(null)}
                  hasCachedMarkdown={!!activeTopic.content_md}
                  onMasteryUpdate={(score, status, conceptName) => {
                    // Refresh topics to update TOC and concept deck mastery indicators
                    client.getTopics(bookId).then(setTopics).catch((err: any) => {
                      console.error(err);
                      showToast('error', err?.userMessage || 'Failed to refresh topics.', err?.debugDetail);
                    });
                  }}
                />
              </div>

              {/* Quick Actions Bar */}
              <div className="px-5 mt-2 flex overflow-x-auto gap-3 pb-1 hide-scrollbar snap-x snap-mandatory items-center">
                {(topics.length <= 1 || activeTopic.title === 'Full Document') && (
                  <button
                    onClick={async () => {
                      try {
                        showToast('info', 'Analyzing handwritten outline with Marker...');
                        const res = await client.reparseHandwriting(bookId);
                        const updated = await client.getTopics(bookId);
                        setTopics(updated);
                        if (updated.length > 0) {
                          dispatch(setActiveTopicId(updated[0].id));
                        }
                        showToast('success', `Generated ${res.topic_count} topics from handwriting!`);
                      } catch (e: any) {
                        showToast('error', e?.userMessage || 'Failed to analyze handwriting.');
                      }
                    }}
                    className="snap-start shrink-0 bg-amber-500/10 border-2 border-amber-600 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-amber-500/20 shadow-[2px_2px_0px_0px_#d97706] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all h-9 font-bold text-xs"
                    title="Extract structured chapters and topics from handwritten notes using Marker"
                  >
                    <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
                    <span>Analyze Handwriting Outline</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setViewMode('pdf');
                    setPdfScrollCommand({ page: activeTopic.start_page, ts: Date.now() });
                  }}
                  className="snap-start shrink-0 bg-surface-container-lowest border-2 border-on-surface rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all h-9 text-on-surface"
                >
                  <FileText size={16} />
                  <span className="font-bold text-xs">View PDF</span>
                </button>
                {activeTopic.content_md && (
                  <button
                    onClick={() => setViewMode('markdown')}
                    className="snap-start shrink-0 bg-surface-container-lowest border-2 border-on-surface rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all h-9 text-on-surface"
                  >
                    <FileText size={16} />
                    <span className="font-bold text-xs">View Markdown</span>
                  </button>
                )}
                <button
                  onClick={handleProcessTopic}
                  disabled={activeTopic.status === 'processing'}
                  className="snap-start shrink-0 bg-primary/10 border-2 border-primary text-primary rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-primary/20 shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all h-9 font-bold text-xs disabled:opacity-50 cursor-pointer"
                  title="Extract atomic concepts to enable per-concept Socratic drills and mastery tracking"
                >
                  {activeTopic.status === 'processing' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>{activeTopic.status === 'processed' ? 'Re-extract Concepts' : 'Extract Concepts'}</span>
                </button>
                <button
                  onClick={() => dispatch(setIsCardGenModalOpen(true))}
                  className="snap-start shrink-0 bg-surface-container-lowest border-2 border-on-surface rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all h-9 text-on-surface"
                >
                  <Zap size={16} />
                  <span className="font-bold text-xs">Generate Flashcards</span>
                </button>
                <button
                  onClick={() => dispatch(setIsNotesOpen(!isNotesOpen))}
                  className={clsx(
                    "snap-start shrink-0 bg-surface-container-lowest border-2 border-on-surface rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all h-9 text-on-surface",
                    isNotesOpen && "bg-primary/10 text-primary border-primary"
                  )}
                >
                  <PenTool size={16} />
                  <span className="font-bold text-xs">Study Notes</span>
                </button>
              </div>

              <div className="px-5 pb-4 flex flex-col gap-2 flex-1 min-h-0 mt-1">

                {/* Atomic Concepts Deck */}
                {(() => {
                  let concepts: AtomicConcept[] = [];
                  if (activeTopic.atomic_concepts) {
                    try {
                      concepts = JSON.parse(activeTopic.atomic_concepts);
                    } catch {
                      concepts = [];
                    }
                  }

                  const masteredCount = concepts.filter(c => c.mastery_status === 'mastered').length;

                  return (
                    <div className="bg-surface-container-lowest border border-border-default rounded-xl shadow-xs p-6">
                      <div 
                        className="flex items-center justify-between mb-4 cursor-pointer group select-none"
                        onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 border border-border-default bg-surface-container-low rounded-lg flex items-center justify-center text-primary group-hover:bg-primary/5 transition-colors">
                            <Layers size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h3 className="font-headline-md text-headline-md font-bold text-primary">
                                Atomic Concepts ({concepts.length})
                              </h3>
                              {concepts.length > 0 && (
                                <span className={clsx(
                                  "text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
                                  masteredCount === concepts.length && concepts.length > 0
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                    : "bg-surface-container text-on-surface-variant border-outline-variant"
                                )}>
                                  {masteredCount}/{concepts.length} Mastered
                                </span>
                              )}
                            </div>
                            <p className="text-label-sm font-label-sm font-bold uppercase tracking-wider text-secondary">
                              Targeted Concept Mastery & Socratic Drills
                            </p>
                          </div>
                        </div>
                        <button className="p-2 text-on-surface-variant group-hover:text-primary group-hover:bg-surface-container rounded-full transition-colors">
                          <ChevronDown 
                            size={24} 
                            className={clsx("transition-transform duration-200", !isSummaryCollapsed && "rotate-180")} 
                          />
                        </button>
                      </div>
                      
                      {!isSummaryCollapsed && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                          {concepts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {concepts.map((concept) => {
                                const isTargeted = selectedDrillConcept?.name === concept.name;
                                const score = concept.mastery_score;

                                return (
                                  <div
                                    key={concept.id || concept.name}
                                    className={clsx(
                                      "border-[2.5px] rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-200 shadow-[2px_2px_0px_0px_#191b23] hover:shadow-[4px_4px_0px_0px_#191b23] hover:-translate-y-[1px]",
                                      isTargeted
                                        ? "border-secondary bg-secondary/5 ring-2 ring-secondary/30"
                                        : "border-on-background bg-surface-container-lowest"
                                    )}
                                  >
                                    <div>
                                      {/* Header: Title & Type Pill */}
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4 className="font-bold text-base text-primary leading-snug">
                                          {concept.name}
                                        </h4>
                                        <span className={clsx(
                                          "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0",
                                          concept.concept_type === 'Formula' ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" :
                                          concept.concept_type === 'Definition' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" :
                                          concept.concept_type === 'Process Step' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" :
                                          concept.concept_type === 'Comparison' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
                                          "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30"
                                        )}>
                                          {concept.concept_type}
                                        </span>
                                      </div>

                                      {/* Summary */}
                                      {concept.summary && (
                                        <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3 mb-3">
                                          {concept.summary}
                                        </p>
                                      )}

                                      {/* Key Terms */}
                                      {concept.key_terms && concept.key_terms.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {concept.key_terms.slice(0, 4).map((term, tIdx) => (
                                            <span
                                              key={tIdx}
                                              className="text-[10px] font-bold px-1.5 py-0.5 bg-surface-container text-on-surface-variant rounded border border-outline-variant/60 uppercase"
                                            >
                                              {term}
                                            </span>
                                          ))}
                                          {concept.key_terms.length > 4 && (
                                            <span className="text-[10px] font-bold px-1 py-0.5 text-on-surface-variant/70">
                                              +{concept.key_terms.length - 4} more
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Bottom: Mastery Progress & Drill Action */}
                                    <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between gap-2 mt-auto">
                                      {/* Mastery indicator */}
                                      <div className="flex items-center gap-2">
                                        <span className={clsx(
                                          "text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
                                          concept.mastery_status === 'mastered' ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40" :
                                          concept.mastery_status === 'developing' ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40" :
                                          concept.mastery_status === 'fragile' ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40" :
                                          concept.mastery_status === 'misconception' ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40" :
                                          "bg-surface-container text-on-surface-variant border-outline-variant"
                                        )}>
                                          {score !== null && score !== undefined
                                            ? `${score}% ${concept.mastery_status}`
                                            : "Untested"}
                                        </span>
                                      </div>

                                      {/* Drill Button */}
                                      <button
                                        onClick={() => {
                                          setSelectedDrillConcept(concept);
                                          drillWidgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                          showToast('info', `Focused Socratic Drill on "${concept.name}"`);
                                        }}
                                        className={clsx(
                                          "text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-on-surface shadow-[1.5px_1.5px_0px_0px_#191b23] flex items-center gap-1.5 transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px]",
                                          isTargeted
                                            ? "bg-secondary text-on-secondary ring-1 ring-secondary"
                                            : "bg-primary text-on-primary hover:bg-academic-blue"
                                        )}
                                      >
                                        <Target size={13} />
                                        <span>{isTargeted ? "Active Drill" : "Drill Concept"}</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-outline-variant rounded-xl text-center gap-3 bg-surface-container-low/40">
                              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary">
                                <Layers size={22} />
                              </div>
                              <div className="max-w-md">
                                <h4 className="font-bold text-sm text-on-surface mb-1">
                                  No atomic concepts extracted yet
                                </h4>
                                <p className="text-xs text-on-surface-variant leading-relaxed">
                                  Extracting atomic concepts breaks this topic down into core invariants, formulas, and definitions — enabling targeted per-concept Socratic drills with diagnostic grading.
                                </p>
                              </div>
                              <button
                                onClick={handleProcessTopic}
                                disabled={activeTopic.status === 'processing'}
                                className="bg-primary text-on-primary font-bold text-xs px-5 py-2.5 rounded-lg border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] flex items-center gap-2 hover:bg-academic-blue active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 cursor-pointer mt-1"
                              >
                                {activeTopic.status === 'processing' ? (
                                  <>
                                    <Loader2 size={15} className="animate-spin" />
                                    <span>Extracting Atomic Concepts...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap size={15} />
                                    <span>Extract Atomic Concepts</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}


                {/* Flashcards List */}
                <div className="flex flex-col flex-1 min-h-[400px] gap-2">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 text-on-surface">
                      <span>Topic Flashcards</span>
                      <span className="bg-primary text-white border-2 border-on-surface px-2.5 py-0.5 text-sm rounded-md shadow-[2px_2px_0px_0px_#191b23]">
                        {activeTopicCards.length > 0 ? `${currentCardIndex + 1} / ${activeTopicCards.length}` : '0'}
                      </span>
                    </h3>
                    {activeTopicCards.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                          disabled={currentCardIndex === 0}
                          className="bg-surface-container-lowest text-on-surface border-2 border-on-surface rounded-lg p-2 shadow-[2px_2px_0px_0px_#191b23] disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          onClick={() => setCurrentCardIndex(Math.min(activeTopicCards.length - 1, currentCardIndex + 1))}
                          disabled={currentCardIndex === activeTopicCards.length - 1}
                          className="bg-surface-container-lowest text-on-surface border-2 border-on-surface rounded-lg p-2 shadow-[2px_2px_0px_0px_#191b23] disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                        >
                          <ChevronRight size={20} />
                        </button>
                        <button
                          onClick={() => setIsPracticeModalOpen(true)}
                          className="bg-primary text-on-primary border-2 border-on-surface rounded-lg px-5 py-2.5 text-sm font-bold flex items-center gap-2 shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all ml-2"
                        >
                          <Play size={16} style={{ fontVariationSettings: "'FILL' 1" }} /> Practice
                        </button>
                      </div>
                    )}
                  </div>

                  {activeTopicCards.length === 0 ? (
                    <div className="flex-1 min-h-0 bg-surface-container-lowest border-2 border-dashed border-on-surface/20 rounded-xl flex flex-col items-center justify-center p-8 relative overflow-hidden">
                      <svg className="absolute inset-0 w-full h-full text-on-surface/5" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                      </svg>
                      <div className="w-20 h-20 rounded-full bg-secondary-container border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] flex items-center justify-center relative z-10 animate-[bounce_3s_infinite]">
                        <Zap size={40} className="text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }} />
                      </div>
                      <div className="text-center z-10 relative mt-4">
                        <h3 className="text-2xl font-bold text-on-surface mb-2">No flashcards generated yet</h3>
                        <p className="text-sm text-on-surface-variant max-w-md mx-auto">
                          Click 'Generate Flashcards' above to automatically extract key concepts and definitions from this section.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-6 relative">
                      {(() => {
                        const card = activeTopicCards[currentCardIndex];
                        if (!card) return null;
                        return (
                          <div key={card.id} className="bg-surface-container-lowest border-2 border-on-surface rounded-xl shadow-[6px_6px_0px_0px_#191b23] group relative transition-all overflow-hidden flex flex-col mb-4">
                            {editingCardId === card.id ? (
                              <div className="p-6 flex flex-col gap-6">
                                <div className="flex flex-col">
                                  <div className="inline-block self-start px-3 py-1 bg-secondary text-white text-xs font-bold uppercase tracking-wider rounded-md border-2 border-on-surface mb-2 shadow-[2px_2px_0px_0px_#191b23]">Question</div>
                                  <textarea
                                    value={editQuestion}
                                    onChange={(e) => setEditQuestion(e.target.value)}
                                    className="w-full min-h-[100px] bg-surface-container-lowest border-2 border-on-surface rounded-lg p-3 text-base font-bold text-on-surface focus:outline-none focus:shadow-[4px_4px_0px_0px_#191b23] transition-all resize-y"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <div className="inline-block self-start px-3 py-1 bg-surface-container-lowest text-on-surface text-xs font-bold uppercase tracking-wider rounded-md border-2 border-on-surface mb-2 shadow-[2px_2px_0px_0px_#191b23]">Answer</div>
                                  <textarea
                                    value={editAnswer}
                                    onChange={(e) => setEditAnswer(e.target.value)}
                                    className="w-full min-h-[150px] bg-primary/5 border-2 border-on-surface rounded-lg p-3 text-base font-medium text-on-surface focus:outline-none focus:shadow-[4px_4px_0px_0px_#191b23] transition-all resize-y"
                                  />
                                </div>
                                <div className="flex justify-end gap-3 pt-2 shrink-0">
                                  <button
                                    onClick={() => setEditingCardId(null)}
                                    className="px-5 py-2.5 text-sm font-bold text-on-surface bg-surface-container-lowest border-2 border-on-surface rounded-lg hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveCard(card.id)}
                                    className="px-5 py-2.5 bg-primary text-on-primary font-bold border-2 border-on-surface rounded-lg shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all text-sm"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="absolute top-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <button
                                    onClick={() => handleStartEdit(card)}
                                    className="p-2 text-on-surface bg-surface hover:bg-surface-container border-2 border-on-surface rounded-lg shadow-[2px_2px_0px_0px_#191b23] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    className="p-2 text-error bg-error/10 hover:bg-error/20 border-2 border-error rounded-lg shadow-[2px_2px_0px_0px_var(--color-error)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                    onClick={() => handleDeleteCard(card.id)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                                <div className="p-6 bg-surface-container-lowest relative">
                                  <div className="inline-block px-3 py-1 bg-secondary text-white text-xs font-bold uppercase tracking-wider rounded-md border-2 border-on-surface mb-4 shadow-[2px_2px_0px_0px_#191b23]">
                                    Question
                                  </div>
                                  <div className="text-lg text-on-surface font-bold prose prose-slate max-w-none pr-24 leading-relaxed">
                                    <MarkdownRenderer content={card.question} />
                                  </div>
                                </div>
                                <div className="p-6 bg-primary/5 border-t-2 border-on-surface">
                                  <div className="inline-block px-3 py-1 bg-surface-container-lowest text-on-surface text-xs font-bold uppercase tracking-wider rounded-md border-2 border-on-surface mb-4 shadow-[2px_2px_0px_0px_#191b23]">
                                    Answer
                                  </div>
                                  <div className="text-base text-on-surface font-medium prose prose-slate max-w-none leading-relaxed">
                                    <MarkdownRenderer content={card.answer} />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          </>
        )}


              
              <div className={clsx(
                "fixed top-[152px] bottom-6 right-6 z-50 transition-all duration-300 transform",
                isChatOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
              )}>
                <AIChatSidebar 
                  key={activeTopic?.id || 'empty'}
                  isOpen={isChatOpen} 
                  onClose={() => setIsChatOpen(false)} 
                  topicId={activeTopic?.id}
                  topicName={activeTopic?.title} 
                  contextMarkdown={activeTopic?.content_md || ''} 
                  isProcessing={activeTopic?.status === 'processing'}
                  onProcessTopic={handleProcessTopic}
                />
              </div>

              {/* Floating Chat Button (hidden when Notes panel is open to avoid obscuring note content) */}
              {!isChatOpen && !isNotesOpen && (
                <button
                  onClick={() => setIsChatOpen(true)}
                  aria-label="Open AI Reading Assistant"
                  title="Open AI Reading Assistant"
                  className="fixed bottom-6 right-6 z-40 w-13 h-13 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
                >
                  <Bot size={24} />
                </button>
              )}

              {/* Dockable Notes Split Panel */}
              {isNotesOpen && activeTopic && (
                <div
                  className={clsx(
                    "border-l border-border-default bg-surface-container-lowest flex flex-col transition-all duration-200 shadow-lg",
                    isNotesExpanded 
                      ? "absolute inset-0 z-50" 
                      : "w-[360px] md:w-[420px] lg:w-[500px] xl:w-[580px] shrink-0 h-full relative z-30"
                  )}
                >
                  <ErrorBoundary>
                    <Suspense
                      fallback={
                        <div className="flex flex-col items-center justify-center h-full">
                          <Loader2 className="animate-spin text-accent-blue w-8 h-8 mb-4" />
                          <p className="text-sm font-medium text-on-surface-variant">Loading Study Notes...</p>
                        </div>
                      }
                    >
                      <NotionNotesEditor
                        key={activeTopic.id}
                        topicId={activeTopic.id}
                        topicTitle={activeTopic.title}
                        isExpanded={isNotesExpanded}
                        onToggleExpand={() => setIsNotesExpanded(!isNotesExpanded)}
                        onClose={() => dispatch(setIsNotesOpen(false))}
                        onGenerateFlashcards={() => dispatch(setIsCardGenModalOpen(true))}
                      />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              )}

      </div>

      <FlashcardGenModal hasCachedMarkdown={!!activeTopic?.content_md} onSuccess={() => reloadTopics()} />
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
    </div>
  );
}
