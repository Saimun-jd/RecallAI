import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sparkles, User, Copy, Check, BrainCircuit, HelpCircle, 
  Cpu, Clock 
} from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { SourceCitationsList } from './SourceCitationsList';
import { cn } from '../../lib/utils';
import type { MessageResponse, SourceCitation } from '../../api/client';

export interface ChatMessageItemProps {
  message: MessageResponse;
  isStreaming?: boolean;
  onInspectCitation?: (citation: SourceCitation) => void;
  className?: string;
}

export function ChatMessageItem({
  message,
  isStreaming = false,
  onInspectCitation,
  className,
}: ChatMessageItemProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = (() => {
    if (!message.created_at) return '';
    try {
      const date = new Date(message.created_at);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col gap-2 p-3.5 sm:p-5 rounded-2xl border-2 border-border-default transition-all',
        isUser
          ? 'bg-surface-container-low/60 ml-2 sm:ml-12 border-primary/20 shadow-neo-sm'
          : 'bg-surface mr-2 sm:mr-8 shadow-neo',
        className
      )}
    >
      {/* Message Header: Role badge, time, provider pill, copy button */}
      <div className="flex items-center justify-between gap-2 border-b border-border-default/40 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {isUser ? (
            <div className="w-7 h-7 rounded-lg bg-primary text-on-primary font-black text-xs flex items-center justify-center shadow-neo-sm shrink-0">
              <User size={14} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shadow-neo-sm shrink-0">
              <Sparkles size={14} />
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-xs uppercase tracking-wider text-on-surface">
              {isUser ? 'You' : 'Recall AI'}
            </span>

            {/* AI Assistant Provider & Token Pill */}
            {!isUser && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant bg-surface-container-high/60 px-2 py-0.5 rounded-full border border-border-default/60">
                <Cpu size={10} className="text-emerald-600 dark:text-emerald-400" />
                <span>Grounded RAG</span>
                {message.token_count > 0 && <span>· {message.token_count} tokens</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Time and actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {formattedTime && (
            <span className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1">
              <Clock size={10} />
              <span>{formattedTime}</span>
            </span>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="Copy message content"
            aria-label="Copy message"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Message Content */}
      <div className="text-sm text-on-surface leading-relaxed overflow-x-auto select-text pt-1">
        {message.content ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <MarkdownRenderer content={message.content} />
            {isStreaming && (
              <span className="inline-block w-2.5 h-4 bg-primary animate-pulse ml-1 align-middle rounded-xs" />
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-primary text-xs font-bold py-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>Consulting knowledge library & synthesizing grounded answer...</span>
          </div>
        ) : (
          <span className="italic text-on-surface-variant text-xs">No response content</span>
        )}
      </div>

      {/* Citations section (assistant only) */}
      {!isUser && message.sources && message.sources.length > 0 && (
        <SourceCitationsList
          sources={message.sources}
          onInspectCitation={onInspectCitation}
        />
      )}

      {/* Study Action Handoffs (assistant only, when generation completed) */}
      {!isUser && !isStreaming && message.content && (
        <div className="mt-3 pt-2.5 border-t border-border-default/40 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Study Handoffs
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const primaryDocId = message.sources?.[0]?.document_id;
                navigate(`/app/flashcards?generate=true${primaryDocId ? `&document_id=${encodeURIComponent(primaryDocId)}` : ''}`);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md text-[11px] font-bold text-on-surface border border-border-default hover:bg-surface-container shadow-2xs hover:shadow-neo-sm transition-all cursor-pointer"
              title="Create study flashcards from this answer"
            >
              <BrainCircuit size={13} className="text-accent-blue" />
              <span>Make Flashcard</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const primaryDocId = message.sources?.[0]?.document_id;
                navigate(`/app/quizzes?generate=true${primaryDocId ? `&document_id=${encodeURIComponent(primaryDocId)}` : ''}`);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md text-[11px] font-bold text-on-surface border border-border-default hover:bg-surface-container shadow-2xs hover:shadow-neo-sm transition-all cursor-pointer"
              title="Generate a self-test quiz from this knowledge"
            >
              <HelpCircle size={13} className="text-amber-500" />
              <span>Test Knowledge</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
