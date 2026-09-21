import React, { useRef, useEffect } from 'react';
import { Send, Square, Globe2, BookOpen, CornerDownLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ChatComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  selectedDocumentTitle?: string | null;
  className?: string;
}

export function ChatComposer({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  selectedDocumentTitle,
  className,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 44), 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && input.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className={cn('relative w-full max-w-4xl mx-auto flex flex-col gap-1.5', className)}>
      {/* Scope Visibility Indicator */}
      <div className="flex items-center justify-between px-2 text-[11px] text-on-surface-variant select-none">
        <div className="flex items-center gap-1.5 truncate">
          {selectedDocumentTitle ? (
            <>
              <BookOpen size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-bold text-on-surface truncate">
                Scoped to: <span className="text-amber-700 dark:text-amber-300 font-black">{selectedDocumentTitle}</span>
              </span>
            </>
          ) : (
            <>
              <Globe2 size={12} className="text-primary shrink-0" />
              <span className="font-bold text-on-surface">
                Knowledge Scope: <span className="text-primary font-black">All Workspace Documents</span>
              </span>
            </>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10px] text-on-surface-variant/70 font-mono">
          <span>Shift + Enter for new line</span>
        </div>
      </div>

      {/* Composer Input Box */}
      <div className="relative flex items-end bg-surface border-2 border-border-default rounded-2xl shadow-neo focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden p-2 gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          rows={1}
          placeholder={
            selectedDocumentTitle
              ? `Ask anything about "${selectedDocumentTitle}"...`
              : 'Ask questions grounded in your study documents...'
          }
          className="flex-1 bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-0 resize-none max-h-44 py-2 px-2 custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          aria-label="Ask a question about your knowledge"
        />

        {/* Action Button: Send or Stop */}
        <div className="shrink-0 pb-0.5 pr-0.5">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-error text-white font-bold text-xs shadow-neo-sm hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
              title="Stop generating response"
              aria-label="Stop generating response"
            >
              <Square size={14} fill="currentColor" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || disabled}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-neo-sm hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center cursor-pointer"
              title="Send question (Enter)"
              aria-label="Send question"
            >
              <Send size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
