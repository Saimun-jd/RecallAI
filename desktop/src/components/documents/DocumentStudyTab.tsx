import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BrainCircuit, Sparkles, HelpCircle, MessageSquare, 
  ArrowRight, Layers, Zap, BookOpen, Loader2, AlertCircle
} from 'lucide-react';
import type { DocumentItem } from '../../api/client';
import { Button } from '../ui/Button';

export interface DocumentStudyTabProps {
  document: DocumentItem;
}

export function DocumentStudyTab({ document }: DocumentStudyTabProps) {
  const navigate = useNavigate();

  const isProcessing = document.status === 'uploading' || document.status === 'processing';
  const isFailed = document.status === 'failed';
  const isReady = document.status === 'ready' || (!document.status && ((document.metadata?.chunk_count as number) || 0) > 0);

  return (
    <div className="space-y-6">
      {/* Active Processing or Failure Banners */}
      {isProcessing ? (
        <div className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 text-xs space-y-1">
          <p className="font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Loader2 size={15} className="animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
            Document Indexing in Progress
          </p>
          <p className="text-on-surface-variant font-medium leading-relaxed">
            This document is still being extracted and embedded. Practice quizzes, flashcard decks, and AI dialogue will become available automatically once indexing finishes.
          </p>
        </div>
      ) : isFailed ? (
        <div className="p-4 rounded-xl border-2 border-error/30 bg-error/10 text-xs space-y-1">
          <p className="font-extrabold text-error flex items-center gap-1.5">
            <AlertCircle size={15} className="text-error shrink-0" />
            Document Processing Failed
          </p>
          <p className="text-on-surface-variant font-medium leading-relaxed">
            {(document.metadata?.processing_error as string) || "Failed to extract readable text from this file."} Assessment generation requires processed chunks. Please re-upload or re-index this document.
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs space-y-1">
          <p className="font-extrabold text-on-surface flex items-center gap-1.5">
            <Zap size={14} className="text-primary" />
            Active Recall & Spaced Repetition Workflows
          </p>
          <p className="text-on-surface-variant font-medium leading-relaxed">
            Transform this document's concepts and chunks into high-retention flashcards, comprehension quizzes, and interactive dialogues.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Flashcards Card */}
        <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo-sm">
              <BrainCircuit size={22} />
            </div>
            <h4 className="font-black text-base text-on-surface">
              Spaced Repetition Deck
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              Reinforce memory using the FSRS algorithm. Study concepts with optimized review schedules tailored to your retention curve.
            </p>
          </div>

          <Button
            variant="primary"
            disabled={!isReady}
            onClick={() => navigate(`/app/flashcards?generate=true&document_id=${document.id}`)}
            className="w-full justify-center gap-2"
          >
            <span>{isProcessing ? 'Indexing...' : isFailed ? 'Document Failed' : 'Study Flashcards'}</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Quizzes Card */}
        <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 border-2 border-amber-500/20 flex items-center justify-center shadow-neo-sm">
              <HelpCircle size={22} />
            </div>
            <h4 className="font-black text-base text-on-surface">
              Practice Quizzes
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              Test your understanding with AI-generated multiple-choice questions grounded directly in the document's text.
            </p>
          </div>

          <Button
            variant="primary"
            disabled={!isReady}
            onClick={() => navigate(`/app/quizzes?generate=true&document_id=${document.id}`)}
            className="w-full justify-center gap-2"
          >
            <span>{isProcessing ? 'Indexing...' : isFailed ? 'Document Failed' : 'Generate Quiz'}</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Knowledge Hub Chat Card */}
        <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 border-2 border-emerald-500/20 flex items-center justify-center shadow-neo-sm">
              <MessageSquare size={22} />
            </div>
            <h4 className="font-black text-base text-on-surface">
              Knowledge Hub Dialogue
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              Ask questions scoped specifically to this document. Receive factual answers cited directly from source pages.
            </p>
          </div>

          <Button
            variant="outline"
            disabled={!isReady}
            onClick={() => navigate(`/app/chat?document_id=${document.id}`)}
            className="w-full justify-center gap-2 border-border-default hover:border-emerald-500/50 hover:bg-emerald-500/5 disabled:opacity-50"
          >
            <span>{isProcessing ? 'Indexing...' : isFailed ? 'Document Failed' : 'Ask Document'}</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
