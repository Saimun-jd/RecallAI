import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Edit2, Bookmark } from 'lucide-react';
import type { PdfAnnotation } from '../api/client';
import { Sparkles, NotebookPen, CreditCard } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

const TYPE_STYLES: Record<string, any> = {
  sidenote: {
    bg: 'bg-yellow-400/40',
    iconBg: 'bg-yellow-400',
    iconColor: 'text-yellow-950 fill-yellow-950',
    label: 'Note'
  },
  ai_explanation: {
    bg: 'bg-fuchsia-500/40',
    iconBg: 'bg-fuchsia-500',
    iconColor: 'text-white fill-white',
    label: 'AI Explanation'
  },
  flashcard_link: {
    bg: 'bg-cyan-400/40',
    iconBg: 'bg-cyan-400',
    iconColor: 'text-cyan-950 fill-cyan-950',
    label: 'Flashcards'
  }
};
interface PdfAnnotationLayerProps {
  annotation: PdfAnnotation;
  highlightPosition: {
    boundingRect: any;
    rects: Array<{ left: number; top: number; width: number; height: number }>;
  };
  onDelete?: (id: number) => void;
  onUpdate?: (id: number, content: string) => void;
}

export function PdfAnnotationLayer({ annotation, highlightPosition, onDelete, onUpdate }: PdfAnnotationLayerProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const style = TYPE_STYLES[annotation.annotation_type] || TYPE_STYLES.sidenote;

  const handleSave = () => {
    onUpdate?.(annotation.id, editContent);
    setIsEditing(false);
  };

  let flashcards: Array<{ question: string; answer: string }> = [];
  if (annotation.annotation_type === 'flashcard_link' && annotation.content) {
    try {
      flashcards = JSON.parse(annotation.content);
    } catch { /* ignore */ }
  }

  // The highlight component uses absolute positioning relative to the page.
  // We can render each rect individually.
  const rects = highlightPosition?.rects || [];
  const boundingRect = highlightPosition?.boundingRect;

  if (!boundingRect) return null;

  return (
    <>
      {/* Highlight rectangles */}
      {rects.map((r, i) => (
        <div 
          key={i}
          title={`Click to view ${style.label}`}
          onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(true); }}
          className={`absolute ${style.bg} rounded-[2px] cursor-pointer pointer-events-auto hover:brightness-110 hover:shadow-sm transition-all z-10 backdrop-brightness-125`} 
          style={{
            left: `${r.left}px`,
            top: `${r.top}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
          }}
        />
      ))}

      {/* Visual Watermark Indicator */}
      <div 
        className="absolute flex items-center justify-center pointer-events-auto z-10 cursor-pointer hover:scale-110 transition-transform drop-shadow-md"
        onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(true); }}
        style={{
          left: `${boundingRect.left}px`,
          top: `${boundingRect.top}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className={`p-1.5 rounded-full ${style.iconBg} ${style.iconColor} ring-2 ring-zinc-950 shadow-lg`}>
          <Bookmark size={14} className={style.iconColor} />
        </div>
      </div>

      {/* Popover Modal */}
      {isPopoverOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(false); }}
        >
          <div
            className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <span className={style.iconColor.replace('fill-', 'text-').split(' ')[0]}>
                  <Bookmark size={16} className={style.iconColor} />
                </span>
                <span className="text-sm font-semibold text-zinc-200">{style.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {annotation.annotation_type === 'sidenote' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); setEditContent(annotation.content || ''); }}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(annotation.id); }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                <div className="w-px h-4 bg-zinc-800 mx-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(false); }}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto custom-scrollbar flex-1">
              {isEditing ? (
                <div className="p-4">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none min-h-[120px]"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-1.5 text-sm bg-amber-500 text-zinc-950 rounded font-medium hover:bg-amber-400 shadow-sm">Save</button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-[15px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {annotation.annotation_type === 'flashcard_link' ? (
                    <div className="space-y-4">
                      {flashcards.map((fc, i) => (
                        <div key={i} className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/80">
                          <div className="font-semibold text-zinc-100 mb-2">{fc.question}</div>
                          <div className="text-zinc-400 text-sm leading-relaxed">{fc.answer}</div>
                        </div>
                      ))}
                      {flashcards.length === 0 && (
                        <div className="text-zinc-500 italic text-center py-4">No flashcards found.</div>
                      )}
                    </div>
                  ) : (
                    annotation.content ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                        <MarkdownRenderer content={annotation.content} />
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic">No content</span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
