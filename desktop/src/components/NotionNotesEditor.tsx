import { useEffect, useState, useRef, useCallback } from 'react';
import { client } from '../api/client';
import { 
  Loader2, Sparkles, Zap, Maximize2, Minimize2, X, PenTool, Eye, Edit3,
  AlignJustify, Grid, FileText, Image as ImageIcon
} from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../hooks/useToast';
import { MarkdownRenderer } from './MarkdownRenderer';
import { noteGenerationRunner } from '../services/noteGenerationRunner';
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
  const noteGeneration = useSelector((state: RootState) => state.reader.noteGeneration);
  const isCurrentTopicGenerating = !!(noteGeneration?.isGenerating && noteGeneration?.topicId === topicId);
  const isOtherTopicGenerating = !!(noteGeneration?.isGenerating && noteGeneration?.topicId !== topicId);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Subscribe to background runner completions so unmounting/remounting across topics preserves results
  useEffect(() => {
    const unsubscribe = noteGenerationRunner.subscribe((completedTopicId, combinedNote) => {
      if (completedTopicId === topicId) {
        setRawMarkdown(combinedNote);
        setMode('preview');
        setSaveStatus('saved');
        showToast('success', 'Cornell Study Guide generated with LaTeX math!');
      }
    });
    return unsubscribe;
  }, [topicId, showToast]);

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

  // Handle AI Cornell Note generation through background runner
  const handleCornellScaffold = async () => {
    try {
      showToast('info', 'Synthesizing Cornell Study Guide with AI...');
      await noteGenerationRunner.startGeneration(topicId, topicTitle || 'Study Topic', activeProvider, rawMarkdown);
    } catch (err: any) {
      console.error("Failed to scaffold note:", err);
      showToast('error', err?.userMessage || err?.message || 'Failed to generate Cornell notes.', err?.debugDetail);
    }
  };

  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select a valid image file.');
      return;
    }
    setIsUploadingImage(true);
    showToast('info', 'Attaching image/diagram...');
    try {
      const res = await client.uploadNoteImage(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "") || "Diagram";
      const markdownImage = `\n\n![${cleanName}](${res.url})\n\n`;
      
      setRawMarkdown(prev => {
        let updated = prev;
        if (textareaRef.current) {
          const start = textareaRef.current.selectionStart ?? prev.length;
          const end = textareaRef.current.selectionEnd ?? prev.length;
          updated = prev.substring(0, start) + markdownImage + prev.substring(end);
        } else {
          updated = prev ? `${prev.trimEnd()}${markdownImage}` : markdownImage.trim();
        }
        handleMarkdownChange(updated);
        return updated;
      });
      showToast('success', 'Diagram attached to notes!');
    } catch (err: any) {
      console.error("Failed to upload note image:", err);
      // Fallback: convert to base64 data URL
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const markdownImage = `\n\n![Diagram](${base64})\n\n`;
        setRawMarkdown(prev => {
          const updated = prev ? `${prev.trimEnd()}${markdownImage}` : markdownImage.trim();
          handleMarkdownChange(updated);
          return updated;
        });
        showToast('success', 'Diagram attached (offline mode)!');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAndInsertImage(file);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          uploadAndInsertImage(file);
          return;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        uploadAndInsertImage(file);
      }
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
    <div 
      className="flex-1 flex flex-col bg-surface-container-lowest overflow-hidden h-full relative"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Hidden file input for diagram attachment */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

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

        {/* Right: Essential Tools (Paper Cycle, View/Edit Toggle, Attach Image, Cornell AI, Window Controls) */}
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

          {/* Attach Image / Diagram */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-surface border border-outline-variant hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            title="Attach an image or diagram (or paste with Ctrl+V, or drag & drop)"
          >
            {isUploadingImage ? <Loader2 size={13} className="animate-spin text-primary" /> : <ImageIcon size={13} className="text-primary" />}
            <span>Image</span>
          </button>

          {/* AI Cornell Notes Generation */}
          <button
            onClick={handleCornellScaffold}
            disabled={isCurrentTopicGenerating || isOtherTopicGenerating || loading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 text-black border-2 border-on-background hover:bg-amber-400 neo-shadow-sm active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all cursor-pointer"
            title={
              isCurrentTopicGenerating 
                ? `Generating notes: ${noteGeneration?.progress ?? 0}%` 
                : isOtherTopicGenerating 
                ? `Generating notes for another topic: ${noteGeneration?.topicTitle}`
                : "Generate Cornell study notes with AI"
            }
          >
            {isCurrentTopicGenerating ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{noteGeneration?.progress ?? 0}%</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Cornell</span>
              </>
            )}
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

      {/* Active Topic Note Generation Progress Banner */}
      {isCurrentTopicGenerating && noteGeneration && (
        <div className="bg-amber-500/10 border-b-2 border-on-background px-4 py-2 shrink-0 flex flex-col gap-1.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold text-on-surface truncate min-w-0">
              <Sparkles size={14} className="text-amber-500 animate-pulse shrink-0" />
              <span className="truncate">
                {noteGeneration.message || (noteGeneration.childTitle ? `Generating: ${noteGeneration.childTitle}` : 'Synthesizing Cornell Study Guide...')}
              </span>
              {noteGeneration.current !== undefined && noteGeneration.total !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                  {noteGeneration.current} / {noteGeneration.total}
                </span>
              )}
            </div>
            <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 shrink-0 ml-2">
              {noteGeneration.progress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant/30">
            <div 
              className="h-full bg-amber-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.max(5, Math.min(100, noteGeneration.progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Background Task Indicator if user switched to another topic while generating */}
      {!isCurrentTopicGenerating && isOtherTopicGenerating && noteGeneration && (
        <div className="bg-primary/10 border-b-2 border-on-background px-4 py-1.5 shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 size={13} className="animate-spin text-primary shrink-0" />
            <span className="text-on-surface truncate font-medium">
              Generating Cornell notes for <strong className="font-bold">{noteGeneration.topicTitle}</strong> in background ({noteGeneration.progress}%)...
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold shrink-0 ml-2">
            Background Active
          </span>
        </div>
      )}

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
              ) : isCurrentTopicGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center mb-4 shadow-[2px_2px_0px_0px_#d97706]">
                    <Sparkles size={32} className="text-amber-500 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-black text-on-surface mb-2 font-handwriting-heading">
                    Synthesizing Master Study Guide...
                  </h3>
                  <p className="text-sm text-on-surface-variant font-medium max-w-md mb-6 leading-relaxed">
                    {noteGeneration?.message || 'Teaching from first principles: deriving theoretical foundations, formatting equations, and working through step-by-step examples.'}
                  </p>

                  <div className="w-full max-w-md bg-surface-container-high rounded-full h-2.5 overflow-hidden border border-outline-variant/40 mb-3 shadow-inner">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(8, Math.min(100, noteGeneration?.progress ?? 10))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between w-full max-w-md text-xs font-mono font-bold text-on-surface-variant mb-6">
                    <span>{noteGeneration?.stage || 'Generating'}</span>
                    <span className="text-amber-600 dark:text-amber-400">{noteGeneration?.progress ?? 0}%</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md w-full text-left text-xs text-on-surface-variant/90 bg-surface-container-low/80 p-3.5 rounded-xl border border-outline-variant/30">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Intuitive mental model & "Why"</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>First-principles & LaTeX anatomy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Step-by-step worked example</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Tiered active-recall test cues</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant text-center">
                  <PenTool size={36} className="mb-3 opacity-30 text-amber-500" />
                  <p className="text-xl font-bold font-handwriting-heading">No study notes yet.</p>
                  <p className="text-sm opacity-75 mt-1 max-w-sm font-handwriting">
                    Click "Cornell" to synthesize an AI study guide with LaTeX math, or switch to Edit to write your own handwritten notes. You can also paste or attach diagrams.
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
                ref={textareaRef}
                value={rawMarkdown}
                onChange={(e) => handleMarkdownChange(e.target.value)}
                onPaste={handlePaste}
                placeholder="Write your study notes in Markdown (LaTeX math like $x^2$ or $$...$$ is fully supported). Paste screenshots directly with Ctrl+V or click Image above..."
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
