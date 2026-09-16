import React from 'react';
import { Loader2, CheckCircle, X } from 'lucide-react';

export interface IngestionProgress {
  current: number;
  total: number;
  topic: string;
  status: 'processing' | 'complete' | 'error';
  error?: string;
  percentage?: number;
  title?: string;
  detail?: string;
  detailLabel?: string;
}

interface IngestionProgressModalProps {
  isOpen: boolean;
  progress: IngestionProgress | null;
  onComplete: () => void;
}

export function IngestionProgressModal({ isOpen, progress, onComplete }: IngestionProgressModalProps) {
  if (!isOpen || !progress) return null;

  const isComplete = progress.status === 'complete';
  const isError = progress.status === 'error';
  const currentChunk = progress.current || 0;
  const totalChunks = progress.total || 1;
  const percent = progress.percentage !== undefined 
    ? Math.min(100, Math.max(0, progress.percentage))
    : Math.min(100, Math.round((currentChunk / totalChunks) * 100));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border-2 border-border-default rounded-2xl shadow-neo-lg w-full max-w-md p-7 sm:p-8 flex flex-col items-center text-center">
        
        {isComplete ? (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 border-2 border-emerald-500/20 shadow-neo-sm">
              <CheckCircle size={32} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black text-on-surface tracking-tight">
              {progress.title || 'Processing Complete!'}
            </h2>
            <p className="text-on-surface-variant text-sm mt-2 mb-6 max-w-sm">
              {progress.topic || 'Your document has been analyzed and topics are ready to study.'}
            </p>
            <button 
              onClick={onComplete}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-sm uppercase tracking-wide border-2 border-border-default shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-150"
            >
              Start Studying
            </button>
          </>
        ) : isError ? (
          <>
            <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mb-5 border-2 border-error/20 shadow-neo-sm">
              <X size={32} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black text-on-surface tracking-tight">
              {progress.title || 'Processing Error'}
            </h2>
            <p className="text-error mt-2 mb-6 text-sm px-4 font-medium break-words max-w-sm">
              {progress.error || 'An unexpected error occurred during processing.'}
            </p>
            <button 
              onClick={onComplete}
              className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-bold text-sm border-2 border-border-default shadow-neo-sm transition-all duration-150"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-5 border-2 border-primary/20 shadow-neo-sm">
              <Loader2 size={32} className="animate-spin stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black text-on-surface tracking-tight">
              {progress.title || 'Processing Document...'}
            </h2>
            
            {/* Progress Bar */}
            <div className="w-full bg-surface-container rounded-full h-3 mt-7 mb-3 overflow-hidden border-2 border-border-default">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-300 ease-out relative" 
                style={{ width: `${percent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            
            <div className="flex justify-between w-full text-xs font-bold text-on-surface-variant mb-6 px-1">
              <span className="text-primary">{percent}% Complete</span>
              <span>
                {progress.detail || (totalChunks > 1 && currentChunk > 0 ? `Chunk ${currentChunk} of ${totalChunks}` : `${percent}%`)}
              </span>
            </div>

            {progress.topic && (
              <div className="bg-surface-container-low border-2 border-border-default rounded-xl px-4 py-3 w-full flex items-center justify-center text-xs font-semibold text-on-surface-variant truncate max-w-full">
                <span className="font-black text-on-surface mr-2 shrink-0">
                  {progress.detailLabel || 'Status'}:
                </span>
                <span className="truncate">{progress.topic}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
