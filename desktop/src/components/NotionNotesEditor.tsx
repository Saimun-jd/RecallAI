import { useEffect, useState, useRef, useCallback } from 'react';
import { client } from '../api/client';
import { 
  Loader2, Sparkles, Zap, Maximize2, Minimize2, X, PenTool, Eye, Edit3,
  AlignJustify, Grid, FileText
} from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../hooks/useToast';
import { MarkdownRenderer } from './MarkdownRenderer';
import clsx from 'clsx';

interface NotionNotesEditorProps {
  topicId: number;
  topicTitle?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
  onGenerateFlashcards?: () => void;
}

export function NotionNotesEditor({
  topicId,
  topicTitle,
  isExpanded,
  onToggleExpand,
  onClose,
  onGenerateFlashcards,
}: NotionNotesEditorProps) {
  const [loading, setLoading] = useState(true);
  const [isScaffolding, setIsScaffolding] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [rawMarkdown, setRawMarkdown] = useState<string>('');
  const [paperStyle, setPaperStyle] = useState<'ruled' | 'grid' | 'plain'>(() => {
    return (localStorage.getItem('notebook-paper-style') as 'ruled' | 'grid' | 'plain') || 'ruled';
  });

  const handlePaperStyleChange = (style: 'ruled' | 'grid' | 'plain') => {
    setPaperStyle(style);
    localStorage.setItem('notebook-paper-style', style);
  };
  
  const { showToast } = useToast();
  const activeProvider = useSelector((state: RootState) => state.providers.activeProvider);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing note on topicId change
  useEffect(() => {
    let active = true;
    const fetchNote = async () => {
      setLoading(true);
      try {
        const { note } = await client.getNote(topicId);
        if (!active) return;

        const text = note || '';
        setRawMarkdown(text);

        if (text && text.trim()) {
          // If note contains content, default to preview (Math View) for crisp KaTeX rendering
          setMode('preview');
        } else {
          setMode('edit');
        }
      } catch (err) {
        console.error("Failed to load note:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchNote();
    return () => { active = false; };
  }, [topicId]);

  // Debounced auto-save from Markdown editor (preserves pristine LaTeX math without lossy conversion)
  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    setRawMarkdown(newMarkdown);
    setSaveStatus('saving');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        await client.updateNote(topicId, newMarkdown);
        setSaveStatus('saved');
      } catch (e) {
        console.error("Failed to save note:", e);
        setSaveStatus('error');
      }
    }, 600);
  }, [topicId]);

  // Handle AI Cornell Note generation
  const handleCornellScaffold = async () => {
    setIsScaffolding(true);
    try {
      showToast('info', 'Synthesizing Cornell Study Guide with AI...');
      const res = await client.generateNoteScaffold(topicId, activeProvider);
      
      const scaffoldText = res.scaffold || res.note || "";
      if (!scaffoldText) {
        throw new Error("No study notes content returned by the AI provider.");
      }

      const existing = rawMarkdown.trim();
      const combined = existing
        ? `${existing}\n\n---\n\n${scaffoldText}`
        : scaffoldText;

      setRawMarkdown(combined);
      await client.updateNote(topicId, combined);

      setMode('preview');
      setSaveStatus('saved');
      if (res.children_count) {
        showToast('success', `Synthesized Master Guide & ${res.children_count} subtopic notes with LaTeX math!`);
      } else {
        showToast('success', 'Cornell Study Guide generated with LaTeX math!');
      }
    } catch (err: any) {
      console.error("Failed to scaffold note:", err);
      showToast('error', err?.userMessage || err?.message || 'Failed to generate Cornell notes.', err?.debugDetail);
    } finally {
      setIsScaffolding(false);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest overflow-hidden h-full relative">
      {/* Simple, Clean Single-Row Top Action Bar - Zero Overflow / No Scrollbar */}
      <div className="h-11 px-3 border-b-[3px] border-on-background bg-surface-container-low flex items-center justify-between shrink-0 select-none z-10 shadow-[0_2px_0px_0px_rgba(0,0,0,0.05)]">
        {/* Left: Topic Title & Save Status */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <PenTool size={14} className="text-amber-500 shrink-0" />
          <span className="font-bold text-xs text-on-surface truncate" title={topicTitle || 'Study Notes'}>
            {topicTitle || 'Study Notes'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-outline-variant text-on-surface-variant shrink-0">
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Saved'}
          </span>
        </div>

        {/* Right: Essential Tools (Paper Cycle, View/Edit Toggle, Cornell AI, Window Controls) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Paper Style Quick Cycle Button */}
          <button
            onClick={cyclePaperStyle}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-surface border border-outline-variant hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            title={`Current paper: ${paperStyle}. Click to change (Ruled / Grid / Clean)`}
          >
            {paperStyle === 'ruled' && <AlignJustify size={13} className="text-primary shrink-0" />}
            {paperStyle === 'grid' && <Grid size={13} className="text-primary shrink-0" />}
            {paperStyle === 'plain' && <FileText size={13} className="text-primary shrink-0" />}
            <span className="capitalize">{paperStyle}</span>
          </button>

          {/* Mode Switcher: Notes vs Edit */}
          <button
            onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}
            className={clsx(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded border-2 border-on-background transition-colors cursor-pointer",
              mode === 'edit'
                ? "bg-primary text-white shadow-xs"
                : "bg-surface text-on-surface hover:bg-surface-container"
            )}
            title={mode === 'preview' ? "Edit note in Markdown" : "View formatted handwritten notes"}
          >
            {mode === 'preview' ? <Edit3 size={13} /> : <Eye size={13} />}
            <span>{mode === 'preview' ? 'Edit' : 'Notes'}</span>
          </button>

          {/* AI Cornell Notes Generation */}
          <button
            onClick={handleCornellScaffold}
            disabled={isScaffolding || loading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 text-black border-2 border-on-background hover:bg-amber-400 neo-shadow-sm active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all cursor-pointer"
            title="Generate Cornell study notes with AI"
          >
            {isScaffolding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>Cornell</span>
          </button>

          {/* Window Controls */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 text-on-surface hover:bg-surface-container rounded transition-colors cursor-pointer ml-0.5"
              title={isExpanded ? "Collapse to side panel" : "Expand full screen"}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-on-surface hover:bg-surface-container rounded transition-colors cursor-pointer"
              title="Close Notes panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area: Handwritten Notebook Sheet in Preview vs Markdown Editor */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 relative bg-surface-container-low/60 custom-scrollbar flex justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/70 backdrop-blur-xs z-20">
            <Loader2 size={24} className="animate-spin text-accent-blue" strokeWidth={2} />
          </div>
        )}

        {mode === 'preview' ? (
          <div className="w-full max-w-3xl pb-16">
            <div
              className={clsx(
                "notebook-sheet w-full min-h-[750px] border border-outline-variant/30",
                paperStyle === 'ruled' && 'notebook-paper-ruled p-5 pl-14 sm:p-7 sm:pl-16',
                paperStyle === 'grid' && 'notebook-paper-grid p-5 sm:p-7',
                paperStyle === 'plain' && 'notebook-paper-plain p-5 sm:p-7'
              )}
            >
              {rawMarkdown.trim() ? (
                <MarkdownRenderer content={rawMarkdown} />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant text-center">
                  <PenTool size={36} className="mb-3 opacity-30 text-amber-500" />
                  <p className="text-xl font-bold font-handwriting-heading">No study notes yet.</p>
                  <p className="text-sm opacity-75 mt-1 max-w-sm font-handwriting">
                    Click "Cornell" to synthesize an AI study guide with LaTeX math, or switch to Edit to write your own handwritten notes.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl h-full flex flex-col pb-6">
            <div
              className={clsx(
                "notebook-sheet flex-1 relative border border-outline-variant/40 overflow-hidden shadow-sm flex flex-col",
                paperStyle === 'ruled' && 'notebook-paper-ruled',
                paperStyle === 'grid' && 'notebook-paper-grid',
                paperStyle === 'plain' && 'notebook-paper-plain'
              )}
            >
              <textarea
                value={rawMarkdown}
                onChange={(e) => handleMarkdownChange(e.target.value)}
                placeholder="Write your study notes in Markdown (LaTeX math like $x^2$ or $$...$$ is fully supported)..."
                className={clsx(
                  "w-full flex-1 min-h-[500px] p-5 bg-transparent text-on-surface font-handwriting text-lg leading-[32px] resize-none focus:outline-none",
                  paperStyle === 'ruled' ? 'pl-14 sm:pl-16' : 'px-5 sm:px-7'
                )}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
