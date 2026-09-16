import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Upload, AlertTriangle, Loader2, BrainCircuit, Sparkles, CheckCircle2, 
  ArrowRight, BookOpen, NotebookPen 
} from 'lucide-react';
import type { DocumentItem, ReviewWorkloadStats } from '../../api/client';

interface NextActionCardProps {
  totalDocuments: number;
  documents: DocumentItem[];
  reviewWorkload: ReviewWorkloadStats;
  onUploadClick: () => void;
}

export function NextActionCard({
  totalDocuments,
  documents,
  reviewWorkload,
  onUploadClick,
}: NextActionCardProps) {
  const failedDocs = documents.filter((d) => d.status === 'failed');
  const processingDocs = documents.filter((d) => d.status === 'processing' || d.status === 'uploading');
  const dueCount = reviewWorkload.due;
  const overdueCount = reviewWorkload.overdue;
  const newCount = reviewWorkload.new;

  // Level 1: Zero documents in workspace
  if (totalDocuments === 0) {
    return (
      <div className="p-6 sm:p-7 rounded-2xl border-2 border-border-default bg-surface shadow-neo-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-0.5">
              <Upload size={24} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider">
                Recommended First Step
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Add your first piece of knowledge
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
                Upload a textbook, lecture packet, or research paper (PDF). Recall AI will break it into structured concepts, grounded Q&A, and spaced repetition flashcards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onUploadClick}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-sm shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all active:translate-x-1 active:translate-y-1"
            >
              <Upload size={16} />
              <span>Add Your First PDF</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Level 2: Failed processing needs attention
  if (failedDocs.length > 0) {
    const firstFailed = failedDocs[0];
    return (
      <div className="p-6 rounded-2xl border-2 border-error/50 bg-error/5 shadow-neo relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-error text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-0.5">
              <AlertTriangle size={24} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-error/30 bg-error/15 text-error text-[11px] font-black uppercase tracking-wider">
                Action Required
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Document processing needs attention
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
                <span className="font-bold text-on-surface">"{firstFailed.title}"</span> encountered an issue: {firstFailed.processing_error || 'Extraction failed'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/documents"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-border-default bg-surface text-on-surface font-extrabold text-sm shadow-neo-sm hover:bg-surface-container hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              <span>View Documents</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Level 3: Processing in progress
  if (processingDocs.length > 0) {
    return (
      <div className="p-6 rounded-2xl border-2 border-primary/50 bg-primary/5 shadow-neo relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-0.5">
              <Loader2 size={24} className="animate-spin stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider">
                In Progress
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Your knowledge is being prepared
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
                {processingDocs.length} document{processingDocs.length > 1 ? 's are' : ' is'} currently being processed by the AI pipeline. Topics and flashcards will be available shortly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/documents"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-border-default bg-surface text-on-surface font-extrabold text-sm shadow-neo-sm hover:bg-surface-container hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              <span>Check Status</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Level 4: Due reviews waiting
  if (dueCount > 0 || overdueCount > 0) {
    return (
      <div className="p-6 sm:p-7 rounded-2xl border-2 border-border-default bg-surface shadow-neo-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-0.5">
              <BrainCircuit size={24} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider">
                Spaced Repetition Due
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                You have reviews waiting today
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
                <span className="font-extrabold text-on-surface">{dueCount} card{dueCount === 1 ? '' : 's'}</span> ready for review
                {overdueCount > 0 && (
                  <span className="text-error font-bold"> ({overdueCount} overdue)</span>
                )}
                . Completing today's reviews keeps your retention rate at peak efficiency.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/app/review"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-sm shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all active:translate-x-1 active:translate-y-1"
            >
              <BrainCircuit size={16} />
              <span>Start Review ({dueCount})</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Level 5: New cards to learn
  if (newCount > 0) {
    return (
      <div className="p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-0.5">
              <Sparkles size={24} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-accent-blue/30 bg-accent-blue/10 text-accent-blue text-[11px] font-black uppercase tracking-wider">
                New Knowledge
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                New study material is ready
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
                You have <span className="font-bold text-on-surface">{newCount} new flashcard{newCount === 1 ? '' : 's'}</span> waiting. Begin studying them to graduate them into the FSRS memory scheduler.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/review"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-sm shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              <Sparkles size={16} />
              <span>Begin Studying</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Level 6: All caught up!
  return (
    <div className="p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-0.5">
            <CheckCircle2 size={24} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[11px] font-black uppercase tracking-wider">
              All Caught Up
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
              You're all caught up for today!
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
              No reviews are waiting right now. Reinforce your retention by exploring your documents, organizing notes, or adding fresh knowledge material.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/documents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border-default bg-surface text-on-surface font-extrabold text-xs sm:text-sm shadow-neo-sm hover:bg-surface-container hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <BookOpen size={15} />
            <span>Explore Documents</span>
          </Link>
          <Link
            to="/notes"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-xs sm:text-sm shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <NotebookPen size={15} />
            <span>Open Notes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
