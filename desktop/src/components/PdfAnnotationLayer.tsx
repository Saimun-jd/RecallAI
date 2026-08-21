import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Edit2, Bookmark } from 'lucide-react';
import type { PdfAnnotation } from '../api/client';
import { Sparkles, NotebookPen, CreditCard } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

const TYPE_STYLES: Record<string, any> = {
  sidenote: {
    bg: 'bg-yellow-400/30',
    iconBg: 'bg-yellow-500',
    iconColor: 'text-white',
    label: 'Note',
    borderColor: 'border-yellow-500/20'
  },
  ai_explanation: {
    bg: 'bg-ai-purple/20',
    iconBg: 'bg-ai-purple',
    iconColor: 'text-white',
    label: 'AI Explanation',
    borderColor: 'border-ai-purple/20'
  },
  flashcard_link: {
    bg: 'bg-accent-blue/20',
    iconBg: 'bg-accent-blue',
    iconColor: 'text-white',
    label: 'Flashcards',
    borderColor: 'border-accent-blue/20'
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
          className={`absolute ${style.bg} rounded-[2px] pointer-events-none z-10`} 
          style={{
            left: `${r.left}px`,
            top: `${r.top}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
          }}
        />
      ))}

      {/* Visual Watermark Indicator - Enhanced Visibility */}
      <div 
        className="absolute flex items-center justify-center pointer-events-auto z-20 cursor-pointer hover:scale-125 transition-all duration-200 ease-out"
        onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(true); }}
        style={{
          left: `${boundingRect.left}px`,
          top: `${boundingRect.top}px`,
          transform: 'translate(-50%, -50%)',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))',
        }}
        title={`Click to view ${style.label}`}
      >
        <div className={`p-2 rounded-full ${style.iconBg} ${style.iconColor} ring-2 ring-white shadow-xl backdrop-blur-sm`}>
          <Bookmark size={16} className={style.iconColor} strokeWidth={2.5} />
        </div>
      </div>

      {/* Popover Modal */}
      {isPopoverOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(false); }}
        >
          <div
            className="w-full max-w-lg bg-surface-container-lowest border border-border-default rounded-[var(--radius-standard)] shadow-[var(--shadow-lg)] flex flex-col overflow-hidden max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border-default flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className={style.iconColor}>
                  <Bookmark size={16} strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold text-primary">{style.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {annotation.annotation_type === 'sidenote' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); setEditContent(annotation.content || ''); }}
                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-[var(--radius-tag)] transition-all duration-200"
                  >
                    <Edit2 size={14} strokeWidth={1.5} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(annotation.id); }}
                  className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-[var(--radius-tag)] transition-all duration-200"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
                <div className="w-px h-4 bg-border-default mx-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(false); }}
                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-[var(--radius-tag)] transition-all duration-200"
                >
                  <X size={16} strokeWidth={1.5} />
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
                    className="w-full bg-surface-container-low border border-border-default rounded-[var(--radius-standard)] p-3 text-sm text-on-surface focus:outline-none focus:border-accent-blue resize-none min-h-[120px] transition-colors duration-200"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button 
                      onClick={() => setIsEditing(false)} 
                      className="px-4 py-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSave} 
                      className="px-4 py-1.5 text-sm bg-accent-blue text-white rounded-[var(--radius-standard)] font-medium hover:bg-secondary-container shadow-[var(--shadow-sm)] transition-all duration-200"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-[15px] text-on-surface whitespace-pre-wrap leading-relaxed">
                  {annotation.annotation_type === 'flashcard_link' ? (
                    <div className="space-y-4">
                      {flashcards.map((fc, i) => (
                        <div key={i} className="bg-surface-container-low p-4 rounded-[var(--radius-standard)] border border-border-default">
                          <div className="font-semibold text-primary mb-2">{fc.question}</div>
                          <div className="text-on-surface-variant text-sm leading-relaxed">{fc.answer}</div>
                        </div>
                      ))}
                      {flashcards.length === 0 && (
                        <div className="text-on-surface-variant italic text-center py-4">No flashcards found.</div>
                      )}
                    </div>
                  ) : (
                    annotation.content ? (
                      <div className="prose prose-slate prose-sm max-w-none">
                        <MarkdownRenderer content={annotation.content} />
                      </div>
                    ) : (
                      <span className="text-on-surface-variant italic">No content</span>
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
