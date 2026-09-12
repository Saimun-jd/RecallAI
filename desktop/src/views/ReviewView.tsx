import { useEffect, useState } from 'react';
import { client, type Flashcard } from '../api/client';
import { Loader2, Brain, Check, Undo2, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useToast } from '../hooks/useToast';
import type { ApiError } from '../api/errors';

type ReviewState = 'loading' | 'question' | 'answer' | 'done';

export function ReviewView() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<ReviewState>('loading');
  const { showToast } = useToast();
  
  const [sessionCount, setSessionCount] = useState(0);
  const [lastReviewedCardId, setLastReviewedCardId] = useState<number | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);

  const fetchDueCards = async () => {
    setState('loading');
    try {
      const due = await client.getDueCards(20);
      setCards(due);
      setCurrentIndex(0);
      if (due.length > 0) {
        setState('question');
      } else {
        setState('done');
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to fetch due cards.', err?.debugDetail);
      setState('done');
    }
  };

  useEffect(() => {
    fetchDueCards();
  }, []);

  const handleShowAnswer = () => {
    if (state === 'question') {
      setState('answer');
    } else if (state === 'answer') {
      setState('question');
    }
  };

  const handleRate = async (rating: number) => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;
    setLastReviewedCardId(currentCard.id);
    
    try {
      await client.submitReview(currentCard.id, rating);
      setSessionCount(prev => prev + 1);
      
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(currentIndex + 1);
        setState('question');
      } else {
        fetchDueCards();
      }
    } catch (err: any) {
      console.error("Failed to submit review", err);
      showToast('error', err?.userMessage || 'Failed to submit review.', err?.debugDetail);
    }
  };

  const handleUndo = async () => {
    if (!lastReviewedCardId || undoLoading) return;
    setUndoLoading(true);
    try {
      await client.undoReview(lastReviewedCardId);
      setLastReviewedCardId(null);
      setSessionCount(prev => Math.max(0, prev - 1));
      await fetchDueCards(); // Refetch to get the undone card back
    } catch (err: any) {
      console.error("Failed to undo review", err);
      showToast('error', err?.userMessage || 'Failed to undo review.', err?.debugDetail);
    } finally {
      setUndoLoading(false);
    }
  };

  // Keyboard shortcut for spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (though there shouldn't be one here)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (state === 'question' || state === 'answer') {
          handleShowAnswer();
        }
      }

      if (state === 'answer') {
        if (e.key === '1') handleRate(1);
        if (e.key === '2') handleRate(2);
        if (e.key === '3') handleRate(3);
        if (e.key === '4') handleRate(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, currentIndex, cards]); // Need dependencies for handleRate closure

  if (state === 'loading') {
    return (
      <div className="flex-1 flex justify-center items-center bg-surface">
        <Loader2 className="animate-spin text-primary w-12 h-12" strokeWidth={2.5} />
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-default rounded-2xl p-8 text-center shadow-lg flex flex-col items-center gap-5">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full flex items-center justify-center shadow-xs">
            <Check size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-on-surface tracking-tight">You're all caught up!</h2>
            <p className="text-on-surface-variant text-sm mt-1">
              No more cards due for review in this session.
            </p>
          </div>
          
          <div className="w-full p-4 border border-border-default rounded-xl bg-surface-container-low/60 text-on-surface flex justify-between items-center shadow-2xs">
            <span className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">Session Progress</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">Cards Reviewed:</span>
              <span className="bg-primary text-on-primary px-2.5 py-0.5 font-bold text-xs rounded-md shadow-2xs">{sessionCount}</span>
            </div>
          </div>
          
          <button 
            onClick={fetchDueCards}
            className="w-full py-3 bg-primary text-on-primary font-semibold text-sm rounded-xl shadow-sm hover:bg-primary/90 hover:shadow transition-all"
          >
            Check for Due Cards
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const isFlipped = state === 'answer';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface">
      {/* Header */}
      <header className="h-16 border-b border-border-default flex items-center justify-between px-6 bg-surface-container-lowest z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-on-surface tracking-tight">Study Center</h2>
          <div className="h-4 w-px bg-border-default"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full border border-border-default shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse"></span>
            <span className="text-xs font-medium text-on-surface-variant">Focus Mode Active</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {lastReviewedCardId && sessionCount > 0 && (
             <button 
               onClick={handleUndo}
               disabled={undoLoading}
               className="flex items-center gap-1.5 px-3 py-1.5 border border-border-default rounded-lg bg-surface-container-lowest text-xs font-semibold text-on-surface shadow-xs hover:bg-surface-container active:scale-98 transition-all disabled:opacity-50"
             >
               {undoLoading ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
               <span>Undo Last</span>
             </button>
          )}
          <div className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs font-semibold text-primary flex items-center gap-1.5 shadow-2xs">
            <TrendingUp size={13} />
            <span>Stability: {currentCard.stability.toFixed(1)}d</span>
          </div>
        </div>
      </header>

      {/* Main Study Zone */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 lg:p-8">
        
        {/* Progress Header */}
        <div className="w-full max-w-2xl flex justify-between items-end mb-4 shrink-0">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Card Progress</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-on-surface">{currentIndex + 1}</span>
              <span className="text-on-surface-variant text-sm font-medium">of {cards.length}</span>
            </div>
          </div>
        </div>

        {/* 3D Flashcard Container */}
        <div className="relative w-full max-w-2xl min-h-[320px] h-[45vh] max-h-[450px] group mb-8 shrink-0">
          <div className={clsx(
            "flashcard-inner w-full h-full relative cursor-pointer",
            isFlipped && "flashcard-flipped"
          )} onClick={handleShowAnswer}>
            
            {/* Front of Card */}
            <div className="flashcard-face absolute inset-0 bg-surface-container-lowest border border-border-default shadow-lg hover:shadow-xl rounded-2xl flex flex-col overflow-hidden transition-shadow">
              <div className="px-6 py-3.5 flex justify-between items-center border-b border-border-default bg-surface-container-low/60">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-2">
                  <Brain size={16} className="text-primary" />
                  <span className="truncate max-w-[240px]">{currentCard.topic_name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-surface-container-lowest text-on-surface-variant px-2.5 py-0.5 border border-border-default rounded-md shadow-2xs">
                    {currentCard.concept_type}
                  </span>
                  <span className="text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 border border-emerald-200 dark:border-emerald-800 rounded-md">
                    {['New', 'Learning', 'Review', 'Relearning'][currentCard.state] || 'Review'}
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 overflow-y-auto custom-scrollbar">
                <div className="prose prose-slate max-w-none prose-p:font-sans prose-p:font-semibold prose-p:text-xl prose-p:leading-snug prose-p:text-on-surface prose-headings:font-bold prose-headings:text-on-surface">
                  <MarkdownRenderer content={currentCard.question} />
                </div>
                <div className="mt-6 flex items-center gap-2 text-on-surface-variant text-xs opacity-75">
                  <kbd className="px-2 py-0.5 bg-surface-container border border-border-default rounded font-mono text-[11px] font-semibold">SPACE</kbd>
                  <span>or click card to reveal answer</span>
                </div>
              </div>
            </div>

            {/* Back of Card */}
            <div className="flashcard-face flashcard-back absolute inset-0 bg-surface-container-lowest border border-border-default shadow-lg hover:shadow-xl rounded-2xl flex flex-col overflow-hidden transition-shadow">
              <div className="px-6 py-3.5 flex justify-between items-center border-b border-border-default bg-primary/5">
                <span className="text-xs font-semibold text-primary flex items-center gap-2">
                  Answer
                </span>
                <span className="text-xs text-on-surface-variant font-medium">
                  Rate your recall below
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 overflow-y-auto custom-scrollbar">
                <div className="prose prose-slate max-w-none prose-p:font-sans prose-p:font-semibold prose-p:text-xl prose-p:leading-snug prose-p:text-on-surface prose-headings:font-bold prose-headings:text-on-surface">
                  <MarkdownRenderer content={currentCard.answer} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Study Controls */}
        <div className={clsx(
          "w-full max-w-2xl grid grid-cols-4 gap-3.5 transition-all duration-300 shrink-0",
          !isFlipped && "opacity-20 pointer-events-none grayscale"
        )}>
          <button 
            onClick={() => handleRate(1)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-surface-container-lowest hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 border border-border-default hover:border-rose-300 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer group active:scale-98"
          >
            <div className="flex items-center gap-1.5">
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container border border-border-default/80 text-on-surface-variant">1</kbd>
              <span className="text-sm font-bold">Again</span>
            </div>
            <span className="text-xs opacity-70 group-hover:opacity-100">&lt; 1m</span>
          </button>

          <button 
            onClick={() => handleRate(2)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-surface-container-lowest hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 border border-border-default hover:border-amber-300 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer group active:scale-98"
          >
            <div className="flex items-center gap-1.5">
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container border border-border-default/80 text-on-surface-variant">2</kbd>
              <span className="text-sm font-bold">Hard</span>
            </div>
            <span className="text-xs opacity-70 group-hover:opacity-100">~ 5m</span>
          </button>

          <button 
            onClick={() => handleRate(3)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-surface-container-lowest hover:bg-blue-50 dark:hover:bg-blue-950/40 text-accent-blue border border-border-default hover:border-blue-300 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer group active:scale-98"
          >
            <div className="flex items-center gap-1.5">
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container border border-border-default/80 text-on-surface-variant">3</kbd>
              <span className="text-sm font-bold">Good</span>
            </div>
            <span className="text-xs opacity-70 group-hover:opacity-100">~ 10m</span>
          </button>

          <button 
            onClick={() => handleRate(4)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-surface-container-lowest hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 border border-border-default hover:border-emerald-300 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer group active:scale-98"
          >
            <div className="flex items-center gap-1.5">
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container border border-border-default/80 text-on-surface-variant">4</kbd>
              <span className="text-sm font-bold">Easy</span>
            </div>
            <span className="text-xs opacity-70 group-hover:opacity-100">~ 4d</span>
          </button>
        </div>

      </div>
    </div>
  );
}
