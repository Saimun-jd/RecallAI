import { Loader2, CheckCircle, X } from 'lucide-react';
import clsx from 'clsx';

interface IngestionProgress {
  current: number;
  total: number;
  topic: string;
  status: 'processing' | 'complete' | 'error';
  error?: string;
  percentage?: number;
}

interface IngestionProgressModalProps {
  isOpen: boolean;
  progress: IngestionProgress | null;
  onComplete: () => void;
}

export function IngestionProgressModal({ isOpen, progress, onComplete }: IngestionProgressModalProps) {
  if (!isOpen) return null;

  const isComplete = progress?.status === 'complete';
  const isError = progress?.status === 'error';
  const currentChunk = progress?.current || 0;
  const totalChunks = progress?.total || 1;
  const percent = progress?.percentage !== undefined ? progress.percentage : Math.round((currentChunk / totalChunks) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] shadow-[var(--shadow-lg)] w-full max-w-md p-8 flex flex-col items-center text-center">
        
        {isComplete ? (
          <>
            <div className="w-16 h-16 bg-accent-blue/10 text-accent-blue rounded-[var(--radius-large)] flex items-center justify-center mb-6 border border-accent-blue/20 shadow-inner">
              <CheckCircle size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-primary tracking-tight">Processing Complete!</h2>
            <p className="text-on-surface-variant mt-2 mb-8">Your flashcards and topics are ready to study.</p>
            <button 
              onClick={onComplete}
              className="w-full py-2.5 bg-accent-blue hover:bg-secondary-container text-white rounded-[var(--radius-standard)] font-semibold shadow-[var(--shadow-sm)] transition-all duration-200"
            >
              Start Studying
            </button>
          </>
        ) : isError ? (
          <>
            <div className="w-16 h-16 bg-error/10 text-error rounded-[var(--radius-large)] flex items-center justify-center mb-6 border border-error/20 shadow-inner">
              <X size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-primary tracking-tight">Processing Error</h2>
            <p className="text-error mt-2 mb-8 text-sm px-4">{progress?.error || 'An unknown error occurred.'}</p>
            <button 
              onClick={onComplete}
              className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-[var(--radius-standard)] font-semibold transition-all duration-200"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-accent-blue/10 text-accent-blue rounded-[var(--radius-large)] flex items-center justify-center mb-6 border border-accent-blue/20 shadow-inner">
              <Loader2 size={32} className="animate-spin" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-primary tracking-tight">Processing AI...</h2>
            
            <div className="w-full bg-surface-container rounded-full h-2.5 mt-8 mb-3 overflow-hidden border border-border-default">
              <div 
                className="bg-accent-blue h-2.5 rounded-full transition-all duration-300 ease-out relative" 
                style={{ width: `${percent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            
            <div className="flex justify-between w-full text-xs font-medium text-on-surface-variant mb-6 px-1">
              <span className="text-accent-blue">{percent}% Complete</span>
              <span>Chunk {currentChunk} of {totalChunks}</span>
            </div>

            {progress?.topic && (
              <div className="bg-surface-container-low border border-border-default rounded-[var(--radius-standard)] px-4 py-3 w-full flex items-center justify-center text-sm text-on-surface-variant truncate max-w-full">
                <span className="font-semibold text-primary mr-2 shrink-0">Topic:</span>
                <span className="truncate">{progress.topic}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
