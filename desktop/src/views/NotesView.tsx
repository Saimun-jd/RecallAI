import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  NotebookPen, Book as BookIcon, Search, Plus, Trash2, ExternalLink, 
  Sparkles, FileText, Copy, Check, AlignJustify, Grid, Edit3, Eye, 
  Layers, ChevronRight, Clock, ArrowUpDown, Filter, X, MessageSquare, 
  Download, BookOpen, AlertCircle, Loader2
} from 'lucide-react';
import { client, type NoteItem, type NoteAnnotationItem, type Book, type Topic } from '../api/client';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useToast } from '../hooks/useToast';
import type { RootState } from '../store';
import clsx from 'clsx';

type CategoryFilter = 'all' | 'cornell' | 'annotations';

export function NotesView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const activeProvider = useSelector((state: RootState) => state.providers.activeProvider);

  // Core Data
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [annotations, setAnnotations] = useState<NoteAnnotationItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection & Filters
  const [selectedType, setSelectedType] = useState<'note' | 'annotation'>('note');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'updated_desc' | 'updated_asc' | 'title_asc' | 'book_asc'>('updated_desc');

  // Workspace Editor State
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'preview' | 'edit'>('preview');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isScaffolding, setIsScaffolding] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [paperStyle, setPaperStyle] = useState<'ruled' | 'grid' | 'plain'>(() => {
    return (localStorage.getItem('notebook-paper-style') as 'ruled' | 'grid' | 'plain') || 'ruled';
  });

  // New Note Modal State
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);
  const [newNoteBookId, setNewNoteBookId] = useState<number | null>(null);
  const [newNoteTopics, setNewNoteTopics] = useState<Topic[]>([]);
  const [newNoteTopicId, setNewNoteTopicId] = useState<number | null>(null);
  const [loadingNewTopics, setLoadingNewTopics] = useState(false);

  // Delete Confirmation State
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<number | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all notes, annotations, and books
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [notesData, annotationsData, booksData] = await Promise.all([
        client.getAllNotes(),
        client.getAllAnnotations(),
        client.getBooks(),
      ]);
      setNotes(notesData);
      setAnnotations(annotationsData);
      setBooks(booksData);

      // Handle URL param selection (?topic=123)
      const topicParam = searchParams.get('topic');
      if (topicParam) {
        const tid = parseInt(topicParam, 10);
        if (!isNaN(tid)) {
          setSelectedType('note');
          setSelectedTopicId(tid);
          const found = notesData.find(n => n.topic_id === tid);
          if (found) {
            setEditorContent(found.content);
          }
        }
      } else if (notesData.length > 0 && selectedTopicId === null && selectedAnnotationId === null) {
        // Default to first note
        setSelectedType('note');
        setSelectedTopicId(notesData[0].topic_id);
        setEditorContent(notesData[0].content);
      }
    } catch (err: any) {
      console.error("Failed to load notes data:", err);
      showToast('error', err?.userMessage || 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync editor content when selection changes
  useEffect(() => {
    if (selectedType === 'note' && selectedTopicId) {
      const found = notes.find(n => n.topic_id === selectedTopicId);
      if (found) {
        setEditorContent(found.content);
        setSaveStatus('saved');
      }
    }
  }, [selectedTopicId, selectedType, notes]);

  // Paper style cycling
  const cyclePaperStyle = () => {
    const nextStyle: Record<'ruled' | 'grid' | 'plain', 'ruled' | 'grid' | 'plain'> = {
      ruled: 'grid',
      grid: 'plain',
      plain: 'ruled',
    };
    const next = nextStyle[paperStyle];
    setPaperStyle(next);
    localStorage.setItem('notebook-paper-style', next);
  };

  // Debounced auto-save
  const handleEditorChange = (newContent: string) => {
    setEditorContent(newContent);
    if (!selectedTopicId) return;

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await client.updateNote(selectedTopicId, newContent);
        setSaveStatus('saved');
        // Update local list
        setNotes(prev => prev.map(n => n.topic_id === selectedTopicId ? { ...n, content: newContent, updated_at: new Date().toISOString() } : n));
      } catch (e) {
        console.error("Auto-save note failed:", e);
        setSaveStatus('error');
      }
    }, 600);
  };

  // Cornell Scaffold Generation
  const handleGenerateCornell = async () => {
    if (!selectedTopicId) return;
    setIsScaffolding(true);
    showToast('info', 'Synthesizing Cornell Study Guide with AI...');
    try {
      const res = await client.generateNoteScaffold(selectedTopicId, activeProvider);
      const scaffoldText = res.scaffold || res.note || "";
      if (!scaffoldText) throw new Error("AI returned empty study guide.");

      const existing = editorContent.trim();
      const combined = existing ? `${existing}\n\n---\n\n${scaffoldText}` : scaffoldText;

      setEditorContent(combined);
      await client.updateNote(selectedTopicId, combined);
      setSaveStatus('saved');
      setEditorMode('preview');

      // Update in state
      setNotes(prev => prev.map(n => n.topic_id === selectedTopicId ? { ...n, content: combined, updated_at: new Date().toISOString() } : n));
      showToast('success', 'Cornell Study Guide generated successfully!');
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to generate Cornell note.');
    } finally {
      setIsScaffolding(false);
    }
  };

  // Copy note content
  const handleCopy = () => {
    if (!editorContent) return;
    navigator.clipboard.writeText(editorContent);
    setIsCopied(true);
    showToast('success', 'Note markdown copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Export note to file
  const handleDownload = () => {
    if (!editorContent || !currentNote) return;
    const blob = new Blob([editorContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentNote.topic_title.replace(/[^a-zA-Z0-9_-]/g, '_')}_notes.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Note downloaded as Markdown!');
  };

  // Delete note
  const handleDeleteNote = async (topicId: number) => {
    try {
      await client.deleteNote(topicId);
      setNotes(prev => prev.filter(n => n.topic_id !== topicId));
      if (selectedTopicId === topicId) {
        const remaining = notes.filter(n => n.topic_id !== topicId);
        if (remaining.length > 0) {
          setSelectedTopicId(remaining[0].topic_id);
          setEditorContent(remaining[0].content);
        } else {
          setSelectedTopicId(null);
          setEditorContent('');
        }
      }
      setConfirmDeleteTopicId(null);
      showToast('success', 'Note deleted.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to delete note.');
    }
  };

  // Book selection in "+ New Note" modal
  const handleNewNoteBookSelect = async (bId: number) => {
    setNewNoteBookId(bId);
    setLoadingNewTopics(true);
    try {
      const topData = await client.getTopics(bId);
      setNewNoteTopics(topData);
      setNewNoteTopicId(topData.length > 0 ? topData[0].id : null);
    } catch (err) {
      console.error("Failed to load topics for book:", err);
    } finally {
      setLoadingNewTopics(false);
    }
  };

  const handleCreateNewNote = async () => {
    if (!newNoteTopicId) return;
    try {
      const existing = notes.find(n => n.topic_id === newNoteTopicId);
      if (existing) {
        setSelectedType('note');
        setSelectedTopicId(newNoteTopicId);
        setEditorContent(existing.content);
        setIsNewNoteModalOpen(false);
        showToast('info', 'Opened existing note for this topic.');
        return;
      }

      // Create empty note or fetch topic
      const topicObj = newNoteTopics.find(t => t.id === newNoteTopicId);
      const bookObj = books.find(b => b.id === newNoteBookId);
      const initialContent = `# ${topicObj?.title || 'Study Notes'}\n\n`;

      await client.updateNote(newNoteTopicId, initialContent);
      const newNoteItem: NoteItem = {
        id: Date.now(),
        topic_id: newNoteTopicId,
        content: initialContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        topic_title: topicObj?.title || 'Study Notes',
        breadcrumb: topicObj?.breadcrumb || '',
        level: topicObj?.level || 1,
        start_page: topicObj?.start_page || 1,
        end_page: topicObj?.end_page || 1,
        book_id: newNoteBookId || 0,
        book_title: bookObj?.title || 'Book',
      };

      setNotes(prev => [newNoteItem, ...prev]);
      setSelectedType('note');
      setSelectedTopicId(newNoteTopicId);
      setEditorContent(initialContent);
      setEditorMode('edit');
      setIsNewNoteModalOpen(false);
      showToast('success', `Created new note for "${topicObj?.title}"`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to initialize note.');
    }
  };

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // Book filter
      if (selectedBookId !== null && n.book_id !== selectedBookId) return false;

      // Category filter
      if (activeCategory === 'cornell') {
        const hasCornellCues = /##\s*📌?\s*Self-Testing Cue Questions|#.*Active Recall/i.test(n.content);
        if (!hasCornellCues) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.topic_title.toLowerCase().includes(q);
        const matchBook = n.book_title.toLowerCase().includes(q);
        const matchBreadcrumb = n.breadcrumb?.toLowerCase().includes(q) || false;
        const matchContent = n.content.toLowerCase().includes(q);
        if (!matchTitle && !matchBook && !matchBreadcrumb && !matchContent) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'updated_desc') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortOrder === 'updated_asc') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sortOrder === 'title_asc') return a.topic_title.localeCompare(b.topic_title);
      if (sortOrder === 'book_asc') return a.book_title.localeCompare(b.book_title);
      return 0;
    });
  }, [notes, selectedBookId, activeCategory, searchQuery, sortOrder]);

  // Filtered Annotations
  const filteredAnnotations = useMemo(() => {
    return annotations.filter(a => {
      if (selectedBookId !== null && a.book_id !== selectedBookId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchBook = a.book_title.toLowerCase().includes(q);
        const matchQuote = a.selected_text.toLowerCase().includes(q);
        const matchContent = (a.content || '').toLowerCase().includes(q);
        if (!matchBook && !matchQuote && !matchContent) return false;
      }
      return true;
    });
  }, [annotations, selectedBookId, searchQuery]);

  // Current selected item objects
  const currentNote = useMemo(() => {
    if (selectedType !== 'note') return null;
    return notes.find(n => n.topic_id === selectedTopicId) || null;
  }, [notes, selectedType, selectedTopicId]);

  const currentAnnotation = useMemo(() => {
    if (selectedType !== 'annotation') return null;
    return annotations.find(a => a.id === selectedAnnotationId) || null;
  }, [annotations, selectedType, selectedAnnotationId]);

  // Metrics
  const metrics = useMemo(() => {
    const totalWords = notes.reduce((sum, n) => {
      const words = n.content.trim().split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0);
    const booksCovered = new Set(notes.map(n => n.book_id)).size;
    const cornellCount = notes.filter(n => /##\s*📌?\s*Self-Testing Cue Questions|#.*Active Recall/i.test(n.content)).length;

    return {
      notesCount: notes.length,
      annotationsCount: annotations.length,
      totalWords,
      booksCovered,
      cornellCount,
    };
  }, [notes, annotations]);

  // Helper to extract clean plain text preview snippet
  const getExcerpt = (md: string) => {
    if (!md) return 'Empty note';
    const plain = md
      .replace(/#+\s+/g, '')
      .replace(/\*\*|__|\*|_/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/>\s+/g, '')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '[Math Equation]')
      .replace(/\$[^\$]*?\$/g, '[Math]')
      .replace(/\n+/g, ' ')
      .trim();
    return plain.length > 130 ? plain.slice(0, 130) + '...' : plain;
  };

  return (
    <div className="flex-1 flex flex-row h-full overflow-hidden bg-background">
      {/* ─────────────────────────────────────────────────────────────
          PANE 1: Left Organization Sidebar (Categories & Books Tree)
      ────────────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r-2 border-on-surface bg-surface-container-low flex flex-col h-full select-none z-10">
        {/* Header with "+ New Note" action */}
        <div className="p-3 border-b-2 border-on-surface flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <NotebookPen size={18} className="text-primary shrink-0" />
            <span className="font-black text-sm uppercase tracking-wider text-on-surface">Notes Hub</span>
          </div>
          <button
            onClick={() => {
              if (books.length > 0) {
                handleNewNoteBookSelect(books[0].id);
              }
              setIsNewNoteModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-primary text-on-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] hover:translate-y-[-1px] active:translate-y-[1px] transition-all cursor-pointer"
            title="Create a new note for a topic"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New</span>
          </button>
        </div>

        {/* Scrollable Directory */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
          {/* Smart Views */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Smart Views
            </div>

            <button
              onClick={() => {
                setActiveCategory('all');
                setSelectedBookId(null);
                setSelectedType('note');
              }}
              className={clsx(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left",
                activeCategory === 'all' && selectedBookId === null && selectedType === 'note'
                  ? "bg-primary text-on-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]"
                  : "text-on-surface hover:bg-surface-container border-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <NotebookPen size={16} />
                <span>All Study Notes</span>
              </div>
              <span className={clsx(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                activeCategory === 'all' && selectedBookId === null && selectedType === 'note'
                  ? "bg-on-primary text-primary"
                  : "bg-surface-container-high text-on-surface-variant"
              )}>
                {metrics.notesCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveCategory('cornell');
                setSelectedBookId(null);
                setSelectedType('note');
              }}
              className={clsx(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left",
                activeCategory === 'cornell' && selectedBookId === null
                  ? "bg-amber-500 text-black border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]"
                  : "text-on-surface hover:bg-surface-container border-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-amber-500 shrink-0" />
                <span>Cornell Guides</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                {metrics.cornellCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveCategory('annotations');
                setSelectedBookId(null);
                setSelectedType('annotation');
                if (annotations.length > 0) {
                  setSelectedAnnotationId(annotations[0].id);
                }
              }}
              className={clsx(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left",
                activeCategory === 'annotations' && selectedBookId === null && selectedType === 'annotation'
                  ? "bg-accent-blue text-white border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]"
                  : "text-on-surface hover:bg-surface-container border-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare size={16} />
                <span>PDF Margin Notes</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-surface-container-high text-on-surface-variant">
                {metrics.annotationsCount}
              </span>
            </button>
          </div>

          {/* Filter by Books */}
          <div className="space-y-1 pt-2">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              <span>Books & Courses</span>
              <span className="font-mono text-[10px]">{books.length}</span>
            </div>

            {books.map(b => {
              const bookNoteCount = notes.filter(n => n.book_id === b.id).length;
              const isSelected = selectedBookId === b.id;

              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBookId(isSelected ? null : b.id);
                    if (activeCategory === 'annotations') {
                      setSelectedType('annotation');
                    } else {
                      setSelectedType('note');
                    }
                  }}
                  className={clsx(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left group",
                    isSelected
                      ? "bg-surface border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] text-primary"
                      : "text-on-surface hover:bg-surface-container border-2 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <BookIcon size={15} className={clsx("shrink-0", isSelected ? "text-primary" : "text-on-surface-variant group-hover:text-primary")} />
                    <span className="truncate" title={b.title}>{b.title}</span>
                  </div>
                  <span className={clsx(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0",
                    isSelected ? "bg-primary/10 text-primary border border-primary/30" : "bg-surface-container text-on-surface-variant"
                  )}>
                    {bookNoteCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Metrics Bar */}
        <div className="p-3 border-t-2 border-on-surface bg-surface text-xs space-y-1 shrink-0">
          <div className="flex justify-between font-medium text-on-surface-variant">
            <span>Total Words:</span>
            <span className="font-mono font-bold text-on-surface">{metrics.totalWords.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-medium text-on-surface-variant">
            <span>Books Covered:</span>
            <span className="font-mono font-bold text-on-surface">{metrics.booksCovered}</span>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          PANE 2: Middle Notes List & Search Pane
      ────────────────────────────────────────────────────────────── */}
      <section className="w-80 lg:w-96 shrink-0 border-r-2 border-on-surface bg-surface-container-lowest flex flex-col h-full select-none z-10">
        {/* Search & Sort Bar */}
        <div className="p-3 border-b-2 border-on-surface bg-surface space-y-2 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in notes, titles, math..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-surface-container-lowest border-2 border-on-surface rounded-md focus:outline-none focus:ring-2 focus:ring-primary shadow-[2px_2px_0px_0px_#191b23] placeholder:text-on-surface-variant/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-mono font-bold text-[11px] text-on-surface-variant">
              {activeCategory === 'annotations' 
                ? `${filteredAnnotations.length} margin notes` 
                : `${filteredNotes.length} notes`}
            </span>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={12} className="text-on-surface-variant" />
              <select
                value={sortOrder}
                onChange={(e: any) => setSortOrder(e.target.value)}
                className="bg-surface text-[11px] font-bold border border-outline-variant rounded px-2 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value="updated_desc">Recently Updated</option>
                <option value="updated_asc">Oldest First</option>
                <option value="title_asc">Title (A-Z)</option>
                <option value="book_asc">By Book</option>
              </select>
            </div>
          </div>
        </div>

        {/* Note Cards List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant gap-2">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs font-bold">Loading notes...</span>
            </div>
          ) : activeCategory === 'annotations' ? (
            /* PDF Annotations List */
            filteredAnnotations.length === 0 ? (
              <div className="text-center py-16 px-4 text-on-surface-variant">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-bold text-xs">No margin notes found</p>
                <p className="text-[11px] opacity-75 mt-1">Highlight text in any PDF reader to add margin notes.</p>
              </div>
            ) : (
              filteredAnnotations.map(annot => {
                const isSelected = selectedType === 'annotation' && selectedAnnotationId === annot.id;
                return (
                  <div
                    key={annot.id}
                    onClick={() => {
                      setSelectedType('annotation');
                      setSelectedAnnotationId(annot.id);
                    }}
                    className={clsx(
                      "p-3 rounded-lg border-2 transition-all cursor-pointer text-left space-y-1.5",
                      isSelected
                        ? "bg-surface border-on-surface shadow-[3px_3px_0px_0px_#191b23] ring-1 ring-primary/40"
                        : "bg-surface-container-low border-transparent hover:border-outline-variant/60 hover:bg-surface"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/30 truncate max-w-[180px]">
                        {annot.book_title}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        Page {annot.page_number}
                      </span>
                    </div>

                    <p className="font-bold text-xs text-on-surface line-clamp-1 italic text-on-surface-variant">
                      "{annot.selected_text}"
                    </p>

                    <p className="text-[11px] text-on-surface font-medium line-clamp-2">
                      {annot.content}
                    </p>
                  </div>
                );
              })
            )
          ) : (
            /* Study Notes Cards */
            filteredNotes.length === 0 ? (
              <div className="text-center py-16 px-4 text-on-surface-variant">
                <NotebookPen size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-bold text-xs">No notes matching filter</p>
                <p className="text-[11px] opacity-75 mt-1">Create a note or change your search filter.</p>
              </div>
            ) : (
              filteredNotes.map(n => {
                const isSelected = selectedType === 'note' && selectedTopicId === n.topic_id;
                const isCornell = /##\s*📌?\s*Self-Testing Cue Questions|#.*Active Recall/i.test(n.content);
                const hasMath = /\$[^$]+\$|\$\$[\s\S]*?\$\$/i.test(n.content);
                const excerpt = getExcerpt(n.content);

                return (
                  <div
                    key={n.topic_id}
                    onClick={() => {
                      setSelectedType('note');
                      setSelectedTopicId(n.topic_id);
                      setEditorContent(n.content);
                    }}
                    className={clsx(
                      "p-3 rounded-lg border-2 transition-all cursor-pointer text-left space-y-1.5",
                      isSelected
                        ? "bg-surface border-on-surface shadow-[3px_3px_0px_0px_#191b23] ring-1 ring-primary/40"
                        : "bg-surface-container-low border-transparent hover:border-outline-variant/60 hover:bg-surface"
                    )}
                  >
                    {/* Top: Book Tag & Time */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate max-w-[180px]">
                        {n.book_title}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                        {new Date(n.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-xs text-on-surface line-clamp-1">
                      {n.topic_title}
                    </h3>

                    {/* Breadcrumb if available */}
                    {n.breadcrumb && (
                      <p className="text-[10px] text-on-surface-variant truncate font-mono">
                        {n.breadcrumb}
                      </p>
                    )}

                    {/* Excerpt Snippet */}
                    <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                      {excerpt}
                    </p>

                    {/* Footer Badges */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {isCornell && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                          <Sparkles size={10} /> Cornell
                        </span>
                      )}
                      {hasMath && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-purple-500/10 text-purple-600 border border-purple-500/30">
                          LaTeX
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-on-surface-variant/70 ml-auto">
                        {n.content.trim().split(/\s+/).filter(Boolean).length}w
                      </span>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PANE 3: Right Note Reader & Editor Workspace
      ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden relative">
        {selectedType === 'note' && currentNote ? (
          <>
            {/* Top Workspace Header & Toolbar */}
            <div className="h-12 px-4 border-b-2 border-on-surface bg-surface flex items-center justify-between shrink-0 select-none z-10 shadow-[0_2px_0px_0px_rgba(0,0,0,0.05)]">
              {/* Left: Topic Title & Book Link */}
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
                <NotebookPen size={16} className="text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs sm:text-sm text-on-surface truncate" title={currentNote.topic_title}>
                      {currentNote.topic_title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-container border border-outline-variant text-on-surface-variant shrink-0">
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Saved'}
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant truncate font-medium">
                    {currentNote.book_title} {currentNote.breadcrumb ? `• ${currentNote.breadcrumb}` : ''}
                  </span>
                </div>
              </div>

              {/* Right: Tools & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Jump to Book Reader */}
                <button
                  onClick={() => navigate(`/books/${currentNote.book_id}?topic=${currentNote.topic_id}`)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-surface border-2 border-on-surface hover:bg-surface-container text-on-surface shadow-[2px_2px_0px_0px_#191b23] hover:translate-y-[-1px] active:translate-y-[1px] transition-all cursor-pointer"
                  title="Open this topic in the Book Reader"
                >
                  <ExternalLink size={13} className="text-primary shrink-0" />
                  <span className="hidden sm:inline">Reader</span>
                </button>

                {/* Paper Style Selector */}
                <button
                  onClick={cyclePaperStyle}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-surface border border-outline-variant hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
                  title={`Current paper: ${paperStyle}. Click to cycle (Ruled / Grid / Plain)`}
                >
                  {paperStyle === 'ruled' && <AlignJustify size={13} className="text-primary shrink-0" />}
                  {paperStyle === 'grid' && <Grid size={13} className="text-primary shrink-0" />}
                  {paperStyle === 'plain' && <FileText size={13} className="text-primary shrink-0" />}
                  <span className="capitalize hidden md:inline">{paperStyle}</span>
                </button>

                {/* Mode Switcher: Notes View vs Edit */}
                <button
                  onClick={() => setEditorMode(editorMode === 'preview' ? 'edit' : 'preview')}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded border-2 border-on-surface transition-all cursor-pointer shadow-[2px_2px_0px_0px_#191b23]",
                    editorMode === 'edit'
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface hover:bg-surface-container"
                  )}
                  title={editorMode === 'preview' ? "Edit note markdown" : "View formatted notebook sheet"}
                >
                  {editorMode === 'preview' ? <Edit3 size={13} /> : <Eye size={13} />}
                  <span>{editorMode === 'preview' ? 'Edit' : 'View'}</span>
                </button>

                {/* AI Cornell Generation */}
                <button
                  onClick={handleGenerateCornell}
                  disabled={isScaffolding}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 text-black border-2 border-on-surface hover:bg-amber-400 shadow-[2px_2px_0px_0px_#191b23] active:translate-y-[1px] disabled:opacity-50 transition-all cursor-pointer"
                  title="Generate or update Cornell active recall guide with AI"
                >
                  {isScaffolding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>Cornell</span>
                </button>

                {/* Copy Markdown */}
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-on-surface hover:bg-surface-container rounded border border-outline-variant transition-colors cursor-pointer"
                  title="Copy note markdown"
                >
                  {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>

                {/* Download Markdown */}
                <button
                  onClick={handleDownload}
                  className="p-1.5 text-on-surface hover:bg-surface-container rounded border border-outline-variant transition-colors cursor-pointer"
                  title="Export to Markdown (.md)"
                >
                  <Download size={14} />
                </button>

                {/* Delete Note */}
                <button
                  onClick={() => setConfirmDeleteTopicId(currentNote.topic_id)}
                  className="p-1.5 text-on-surface hover:bg-red-500/10 hover:text-red-500 rounded border border-outline-variant transition-colors cursor-pointer"
                  title="Delete note"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Note Sheet Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative bg-surface-container-low/50 custom-scrollbar flex justify-center">
              {editorMode === 'preview' ? (
                <div className="w-full max-w-4xl pb-20">
                  <div
                    className={clsx(
                      "notebook-sheet w-full min-h-[850px] border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] rounded-lg",
                      paperStyle === 'ruled' && 'notebook-paper-ruled p-6 pl-14 sm:p-8 sm:pl-18',
                      paperStyle === 'grid' && 'notebook-paper-grid p-6 sm:p-8',
                      paperStyle === 'plain' && 'notebook-paper-plain p-6 sm:p-8'
                    )}
                  >
                    {editorContent.trim() ? (
                      <MarkdownRenderer content={editorContent} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-28 text-on-surface-variant text-center">
                        <NotebookPen size={42} className="mb-3 opacity-30 text-primary" />
                        <p className="text-xl font-bold">This note is currently empty.</p>
                        <p className="text-xs opacity-75 mt-1 max-w-sm">
                          Switch to Edit mode to write your thoughts or click "Cornell" to generate an authoritative AI study guide.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-4xl h-full flex flex-col pb-6">
                  <div
                    className={clsx(
                      "notebook-sheet flex-1 relative border-2 border-on-surface rounded-lg shadow-[4px_4px_0px_0px_#191b23] overflow-hidden flex flex-col",
                      paperStyle === 'ruled' && 'notebook-paper-ruled',
                      paperStyle === 'grid' && 'notebook-paper-grid',
                      paperStyle === 'plain' && 'notebook-paper-plain'
                    )}
                  >
                    <textarea
                      value={editorContent}
                      onChange={(e) => handleEditorChange(e.target.value)}
                      placeholder="Write your study notes in Markdown (LaTeX math like $x^2$ or $$...$$ is fully supported)..."
                      className={clsx(
                        "w-full flex-1 min-h-[500px] p-6 bg-transparent text-on-surface font-handwriting text-lg leading-[32px] resize-none focus:outline-none",
                        paperStyle === 'ruled' ? 'pl-14 sm:pl-18' : 'px-6 sm:px-8'
                      )}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : selectedType === 'annotation' && currentAnnotation ? (
          /* PDF Annotation Detail View */
          <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="h-12 px-4 border-b-2 border-on-surface bg-surface flex items-center justify-between shrink-0 shadow-[0_2px_0px_0px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-accent-blue" />
                <span className="font-bold text-xs sm:text-sm text-on-surface">
                  PDF Margin Annotation • {currentAnnotation.book_title} (Page {currentAnnotation.page_number})
                </span>
              </div>

              <button
                onClick={() => navigate(`/books/${currentAnnotation.book_id}`)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-surface border-2 border-on-surface hover:bg-surface-container text-on-surface shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
              >
                <ExternalLink size={13} className="text-accent-blue" />
                <span>Go to Page {currentAnnotation.page_number}</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-surface-container-low/50">
              <div className="w-full max-w-2xl space-y-4">
                {/* Quoted Text Card */}
                <div className="p-4 rounded-lg bg-surface border-2 border-on-surface shadow-[3px_3px_0px_0px_#191b23] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">
                    Referenced Excerpt from Page {currentAnnotation.page_number}
                  </span>
                  <blockquote className="border-l-4 border-accent-blue pl-3 py-1 italic font-serif text-sm text-on-surface">
                    "{currentAnnotation.selected_text}"
                  </blockquote>
                </div>

                {/* Sidenote Content */}
                <div className="p-6 rounded-lg bg-surface border-2 border-on-surface shadow-[3px_3px_0px_0px_#191b23] space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">
                    Study Note / AI Explanation
                  </span>
                  <div className="prose dark:prose-invert max-w-none text-sm text-on-surface">
                    <MarkdownRenderer content={currentAnnotation.content || ''} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Workspace Placeholder */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
            <div className="w-16 h-16 rounded-2xl border-2 border-on-surface bg-surface shadow-[4px_4px_0px_0px_#191b23] flex items-center justify-center mb-4">
              <NotebookPen size={32} className="text-primary" />
            </div>
            <h2 className="text-lg font-black text-on-surface">No Note Selected</h2>
            <p className="text-xs max-w-sm mt-1 mb-4 leading-relaxed">
              Select a study note or margin note from the list, or click "+ New" to start writing notes for any topic in your library.
            </p>
            {books.length > 0 && (
              <button
                onClick={() => {
                  handleNewNoteBookSelect(books[0].id);
                  setIsNewNoteModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-on-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] hover:translate-y-[-1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>Create a Study Note</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Create New Note for Topic
      ────────────────────────────────────────────────────────────── */}
      {isNewNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border-2 border-on-surface rounded-xl shadow-[6px_6px_0px_0px_#191b23] p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-on-surface pb-3">
              <div className="flex items-center gap-2">
                <NotebookPen size={18} className="text-primary" />
                <h3 className="font-black text-sm uppercase tracking-wider text-on-surface">Create Study Note</h3>
              </div>
              <button
                onClick={() => setIsNewNoteModalOpen(false)}
                className="p-1 hover:bg-surface-container rounded text-on-surface-variant cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Select Book */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface mb-1">
                  1. Select Book / Document
                </label>
                <select
                  value={newNoteBookId || ''}
                  onChange={(e) => handleNewNoteBookSelect(parseInt(e.target.value, 10))}
                  className="w-full p-2 text-xs font-bold bg-surface-container-lowest border-2 border-on-surface rounded-md focus:outline-none cursor-pointer"
                >
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>

              {/* Select Topic */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface mb-1">
                  2. Select Topic / Chapter
                </label>
                {loadingNewTopics ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-on-surface-variant font-medium">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span>Loading chapters & topics...</span>
                  </div>
                ) : newNoteTopics.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic py-2">
                    No topics found in this book. Please process the table of contents first.
                  </p>
                ) : (
                  <select
                    value={newNoteTopicId || ''}
                    onChange={(e) => setNewNoteTopicId(parseInt(e.target.value, 10))}
                    className="w-full p-2 text-xs font-bold bg-surface-container-lowest border-2 border-on-surface rounded-md focus:outline-none cursor-pointer"
                  >
                    {newNoteTopics.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.breadcrumb ? `${t.breadcrumb} • ${t.title}` : t.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-on-surface">
              <button
                onClick={() => setIsNewNoteModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold rounded bg-surface border-2 border-outline-variant hover:bg-surface-container text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewNote}
                disabled={!newNoteTopicId || loadingNewTopics}
                className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-on-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Open / Create Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Confirm Delete Note
      ────────────────────────────────────────────────────────────── */}
      {confirmDeleteTopicId !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface border-2 border-on-surface rounded-xl shadow-[6px_6px_0px_0px_#191b23] p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={20} />
              <h3 className="font-black text-sm uppercase tracking-wider">Delete Study Note?</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to delete this study note? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={() => setConfirmDeleteTopicId(null)}
                className="px-3 py-1.5 text-xs font-bold rounded bg-surface border-2 border-outline-variant hover:bg-surface-container text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNote(confirmDeleteTopicId)}
                className="px-4 py-1.5 text-xs font-bold rounded bg-red-600 text-white border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] hover:bg-red-700 transition-all cursor-pointer"
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
