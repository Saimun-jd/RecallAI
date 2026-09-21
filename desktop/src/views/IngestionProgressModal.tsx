import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, X, Sparkles } from 'lucide-react';
import { DIALOG_VARIANTS, BACKDROP_VARIANTS, TRANSITIONS, SPRINGS } from '../lib/motion';
import { usePrefersReducedMotion } from '../components/ui/motion';

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
  const shouldReduceMotion = usePrefersReducedMotion();

  if (!isOpen || !progress) return null;

  const isComplete = progress.status === 'complete';
  const isError = progress.status === 'error';
  const currentChunk = progress.current || 0;
  const totalChunks = progress.total || 1;
  const percent = progress.percentage !== undefined 
    ? Math.min(100, Math.max(0, progress.percentage))
    : Math.min(100, Math.round((currentChunk / totalChunks) * 100));

  const stateKey = isComplete ? 'complete' : isError ? 'error' : 'processing';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          variants={BACKDROP_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          variants={shouldReduceMotion ? { initial: {}, animate: {}, exit: {} } : DIALOG_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative bg-surface border-2 border-border-default rounded-2xl shadow-neo-lg w-full max-w-md p-7 sm:p-8 flex flex-col items-center text-center z-10 overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {isComplete ? (
              <motion.div
                key="complete"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={TRANSITIONS.fast}
                className="w-full flex flex-col items-center"
              >
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
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-sm uppercase tracking-wide border-2 border-border-default shadow-neo hover:shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-120 cursor-pointer"
                >
                  Start Studying
                </button>
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={TRANSITIONS.fast}
                className="w-full flex flex-col items-center"
              >
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
                  className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-bold text-sm border-2 border-border-default shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-120 cursor-pointer"
                >
                  Close
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="processing"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={TRANSITIONS.fast}
                className="w-full flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-5 border-2 border-primary/20 shadow-neo-sm">
                  <Loader2 size={32} className="animate-spin stroke-[2.5]" />
                </div>
                <h2 className="text-xl font-black text-on-surface tracking-tight">
                  {progress.title || 'Processing Document...'}
                </h2>
                
                {/* Real Progress Bar */}
                <div className="w-full bg-surface-container rounded-full h-3 mt-7 mb-3 overflow-hidden border-2 border-border-default">
                  <motion.div 
                    className="bg-primary h-full rounded-full relative" 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                  </motion.div>
                </div>
                
                <div className="flex justify-between w-full text-xs font-bold text-on-surface-variant mb-6 px-1">
                  <span className="text-primary">{percent}% Complete</span>
                  <span>
                    {progress.detail || (totalChunks > 1 && currentChunk > 0 ? `Chunk ${currentChunk} of ${totalChunks}` : `${percent}%`)}
                  </span>
                </div>

                {progress.topic && (
                  <div className="bg-surface-container-low border-2 border-border-default rounded-xl px-4 py-3 w-full flex items-center justify-center text-xs font-semibold text-on-surface-variant truncate max-w-full shadow-neo-xs">
                    <span className="font-black text-on-surface mr-2 shrink-0">
                      {progress.detailLabel || 'Status'}:
                    </span>
                    <span className="truncate">{progress.topic}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
