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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center text-center">
        
        {isComplete ? (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-inner">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Processing Complete!</h2>
            <p className="text-zinc-400 mt-2 mb-8">Your flashcards and topics are ready to study.</p>
            <button 
              onClick={onComplete}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg font-semibold shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
            >
              Start Studying
            </button>
          </>
        ) : isError ? (
          <>
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 shadow-inner">
              <X size={32} />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Processing Error</h2>
            <p className="text-red-400 mt-2 mb-8 text-sm px-4">{progress?.error || 'An unknown error occurred.'}</p>
            <button 
              onClick={onComplete}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-inner">
              <Loader2 size={32} className="animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Processing AI...</h2>
            
            <div className="w-full bg-zinc-950 rounded-full h-2.5 mt-8 mb-3 overflow-hidden border border-zinc-800">
              <div 
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)] relative" 
                style={{ width: `${percent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            
            <div className="flex justify-between w-full text-xs font-medium text-zinc-500 mb-6 px-1">
              <span className="text-emerald-500/80">{percent}% Complete</span>
              <span>Chunk {currentChunk} of {totalChunks}</span>
            </div>

            {progress?.topic && (
              <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-lg px-4 py-3 w-full flex items-center justify-center text-sm text-zinc-400 truncate max-w-full">
                <span className="font-semibold text-zinc-300 mr-2 shrink-0">Topic:</span>
                <span className="truncate">{progress.topic}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
