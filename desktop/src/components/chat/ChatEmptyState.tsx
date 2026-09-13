import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, BookOpen, Globe2, ArrowRight, Lightbulb, 
  HelpCircle, Upload, Bookmark 
} from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../lib/utils';

export interface ChatEmptyStateProps {
  selectedDocumentTitle?: string | null;
  hasDocuments: boolean;
  onSelectPrompt: (prompt: string) => void;
  className?: string;
}

export function ChatEmptyState({
  selectedDocumentTitle,
  hasDocuments,
  onSelectPrompt,
  className,
}: ChatEmptyStateProps) {
  const navigate = useNavigate();

  const documentPrompts = [
    'Explain the primary thesis and key concepts in this document.',
    'What are the most critical definitions and terms to remember?',
    'Summarize the key takeaways and main arguments section by section.',
    'Create 3 challenging review questions based strictly on this text.',
  ];

  const globalPrompts = [
    'What are the main themes and concepts across all my uploaded study materials?',
    'Synthesize a comprehensive study guide from my recent documents.',
    'Compare and contrast the key ideas found in my documents.',
    'What should I prioritize reviewing for an upcoming comprehensive exam?',
  ];

  const activePrompts = selectedDocumentTitle ? documentPrompts : globalPrompts;

  return (
    <div className={cn('flex flex-col items-center justify-center max-w-2xl mx-auto py-8 sm:py-12 px-4 text-center', className)}>
      {/* Icon Badge */}
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary border-2 border-primary/30 flex items-center justify-center shadow-neo mb-5 animate-in zoom-in-95 duration-200">
        <Sparkles size={28} />
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight mb-2">
        Ask your knowledge.
      </h2>
      <p className="text-xs sm:text-sm text-on-surface-variant font-medium leading-relaxed max-w-lg mb-6">
        Ask questions about the documents you've added, compare ideas, explain difficult concepts,
        or explore connections between what you've learned.
      </p>

      {/* Scope Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-border-default bg-surface shadow-neo-sm text-xs font-bold text-on-surface mb-8 select-none">
        {selectedDocumentTitle ? (
          <>
            <BookOpen size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Scoped to: <span className="font-black text-amber-700 dark:text-amber-300">{selectedDocumentTitle}</span></span>
          </>
        ) : (
          <>
            <Globe2 size={14} className="text-primary" />
            <span>Searching across all uploaded documents</span>
          </>
        )}
      </div>

      {/* No documents warning state */}
      {!hasDocuments ? (
        <div className="w-full p-6 rounded-2xl border-2 border-dashed border-border-default bg-surface-container-low text-left space-y-4 shadow-neo-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <Upload size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-sm text-on-surface">No documents in your library yet</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Recall AI grounds every answer in your actual files. Upload a PDF, text, or markdown document
                to begin asking grounded questions with verified page citations.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={() => navigate('/documents')}
            className="w-full sm:w-auto gap-2"
          >
            <span>Go to Documents</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      ) : (
        /* Suggested Prompt Chips */
        <div className="w-full space-y-3">
          <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
            <Lightbulb size={14} className="text-amber-500" />
            <span>Suggested prompts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
            {activePrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(prompt)}
                className="p-3.5 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container-low text-xs font-bold text-on-surface shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-start gap-2.5 group cursor-pointer"
              >
                <HelpCircle size={14} className="text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span className="leading-snug">{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
