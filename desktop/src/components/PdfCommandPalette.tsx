import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Sparkles, NotebookPen, CreditCard, X, Loader2 } from 'lucide-react';
import type { PdfSelection } from './PdfViewer';

import { MarkdownRenderer } from './MarkdownRenderer';

export type PdfCommandType = 'generate_flashcards' | 'explain_ai' | 'add_sidenote';

interface PdfCommandPaletteProps {
  selection: PdfSelection;
  /** Absolute position within the PDF scroll container */
  position: { x: number; y: number };
  onCommand: (type: PdfCommandType, options?: { prompt?: string; count?: number; note?: string; preview?: boolean; pin_content?: string; }) => Promise<any> | void;
  onDismiss: () => void;
  isLoading?: boolean;
}

const COMMANDS = [
  {
    type: 'generate_flashcards' as PdfCommandType,
    icon: CreditCard,
    label: 'Generate Flashcards',
    description: 'Create flashcards from this selection',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    type: 'explain_ai' as PdfCommandType,
    icon: Sparkles,
    label: 'Explain with AI',
    description: 'Get an AI explanation of this text',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  {
    type: 'add_sidenote' as PdfCommandType,
    icon: NotebookPen,
    label: 'Add Sidenote',
    description: 'Attach a personal note to this section',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
];

export function PdfCommandPalette({ selection, position, onCommand, onDismiss, isLoading }: PdfCommandPaletteProps) {
  const [activeCommand, setActiveCommand] = useState<PdfCommandType | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [flashcardCount, setFlashcardCount] = useState(5);
  const [sidenoteText, setSidenoteText] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewData, setPreviewData] = useState<any>(null);
  const [offsetY, setOffsetY] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewData) {
          setPreviewData(null);
        } else if (activeCommand) {
          setActiveCommand(null);
        } else {
          onDismiss();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onDismiss, activeCommand, previewData]);

  // Prevent palette from overflowing bottom of viewport
  useLayoutEffect(() => {
    if (paletteRef.current) {
      // Reset transform temporarily to measure natural position
      paletteRef.current.style.transform = 'none';
      const rect = paletteRef.current.getBoundingClientRect();
      const overflowBottom = rect.bottom - window.innerHeight;
      
      if (overflowBottom > 0) {
        // Shift it up by the overflow amount plus a little padding (24px)
        setOffsetY(-overflowBottom - 24);
      } else {
        setOffsetY(0);
      }
    }
  }, [activeCommand, previewData, isLoading]);

  // Focus input when sub-form opens
  useEffect(() => {
    if (activeCommand && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeCommand]);

  // Keyboard navigation in command list
  useEffect(() => {
    if (activeCommand) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, COMMANDS.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setActiveCommand(COMMANDS[selectedIdx].type);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCommand, selectedIdx]);

  const handleSubmit = async () => {
    if (!activeCommand) return;
    const isSidenote = activeCommand === 'add_sidenote';
    if (isSidenote && !sidenoteText.trim()) return;

    setIsProcessing(true);
    try {
      const res = await onCommand(activeCommand, { 
        prompt: customPrompt || undefined, 
        count: flashcardCount, 
        note: sidenoteText.trim(),
        preview: !isSidenote
      });
      if (res && !isSidenote) {
        setPreviewData(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePin = async () => {
    if (!activeCommand) return;
    setIsProcessing(true);
    try {
      let pin_content = undefined;
      if (previewData) {
        pin_content = activeCommand === 'explain_ai' 
          ? previewData.content 
          : JSON.stringify(previewData.flashcards);
      }

      await onCommand(activeCommand, { 
        prompt: customPrompt || undefined, 
        count: flashcardCount, 
        note: sidenoteText.trim(),
        preview: false,
        pin_content
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const truncatedText = selection.text.length > 80 ? selection.text.slice(0, 80) + '…' : selection.text;

  return (
    <div
      ref={paletteRef}
      className="relative z-50 w-80 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-sm"
      style={{
        transform: `translateY(${offsetY}px)`,
        transition: 'transform 0.15s ease-out'
      }}
    >
      {/* Header with selected text preview */}
      <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Selected Text</p>
          <p className="text-xs text-zinc-400 truncate" title={selection.text}>
            "{truncatedText}"
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="ml-2 p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Loading overlay */}
      {(isLoading || isProcessing) && (
        <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center z-10 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">Processing…</span>
          </div>
        </div>
      )}

      {/* Preview Screen */}
      {previewData && (
        <div className="flex flex-col max-h-96">
          <div className="p-3 overflow-y-auto min-h-0 border-b border-zinc-800">
            {activeCommand === 'explain_ai' ? (
              <div className="text-sm text-zinc-300 prose prose-invert prose-sm max-w-none">
                <MarkdownRenderer content={previewData.content || ''} />
              </div>
            ) : activeCommand === 'generate_flashcards' ? (
              <div className="space-y-2">
                {(previewData.flashcards || []).map((fc: any, i: number) => (
                  <div key={i} className="bg-zinc-950 rounded-lg p-2.5 border border-zinc-800">
                    <p className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold mb-1">Q{i + 1}</p>
                    <p className="text-xs text-zinc-300 mb-1.5">{fc.question}</p>
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Answer</p>
                    <p className="text-xs text-zinc-400">{fc.answer}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="p-2 flex justify-end gap-2 bg-zinc-950/50">
            <button
              onClick={() => setPreviewData(null)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handlePin}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 text-zinc-950 rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Pin to PDF
            </button>
          </div>
        </div>
      )}

      {/* Command list */}
      {!activeCommand && !previewData && (
        <div className="p-1.5">
          {COMMANDS.map((cmd, idx) => (
            <button
              key={cmd.type}
              onClick={() => setActiveCommand(cmd.type)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-100 ${
                idx === selectedIdx
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <div className={`p-1.5 rounded-md ${cmd.bgColor}`}>
                <cmd.icon size={15} className={cmd.color} />
              </div>
              <div>
                <p className="text-sm font-medium">{cmd.label}</p>
                <p className="text-[11px] text-zinc-500">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sub-forms */}
      {activeCommand === 'generate_flashcards' && !previewData && (
        <div className="p-3 space-y-3">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Custom Prompt (optional)</label>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus on key definitions"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Number of Flashcards</label>
            <input
              type="number"
              min={1}
              max={20}
              value={flashcardCount}
              onChange={(e) => setFlashcardCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
              className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setActiveCommand(null)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-colors"
            >
              Generate
            </button>
          </div>
        </div>
      )}

      {activeCommand === 'explain_ai' && !previewData && (
        <div className="p-3 space-y-3">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Custom Prompt (optional)</label>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Explain this in simpler terms"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setActiveCommand(null)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 text-zinc-950 rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Explain
            </button>
          </div>
        </div>
      )}

      {activeCommand === 'add_sidenote' && !previewData && (
        <div className="p-3 space-y-3">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Your Note</label>
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={sidenoteText}
              onChange={(e) => setSidenoteText(e.target.value)}
              placeholder="Type your note here..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 resize-y min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-600">Ctrl+Enter to save</span>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveCommand(null)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!sidenoteText.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-zinc-950 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
