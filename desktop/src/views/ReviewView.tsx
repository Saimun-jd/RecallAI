import { useEffect, useState } from 'react';
import { client, type Flashcard } from '../api/client';
import { Loader2, Brain, Check, Undo2, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

type ReviewState = 'loading' | 'question' | 'answer' | 'done';

export function ReviewView() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<ReviewState>('loading');
  
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
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error("Failed to submit review", err);
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
    } catch (err) {
      console.error("Failed to undo review", err);
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
        <div className="w-full max-w-lg bg-surface-container-lowest border-2 border-on-surface rounded-xl p-10 text-center shadow-[8px_8px_0px_0px_#191b23] flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-secondary border-2 border-on-surface text-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#191b23]">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black text-on-surface uppercase tracking-tight">You're all caught up!</h2>
          <p className="text-on-surface-variant font-bold text-base">
            No more cards to review right now.
          </p>
          
          <div className="w-full mt-4 p-4 border-2 border-on-surface rounded-lg bg-surface text-on-surface flex justify-between items-center shadow-[4px_4px_0px_0px_#191b23]">
            <span className="font-bold uppercase tracking-wider text-sm">Session Stats</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Cards Reviewed:</span>
              <span className="bg-primary text-white px-3 py-1 font-black rounded-md border-2 border-on-surface">{sessionCount}</span>
            </div>
          </div>
          
          <button 
            onClick={fetchDueCards}
            className="w-full mt-4 py-4 bg-primary text-white font-black uppercase text-lg rounded-xl border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
          >
            Check Again
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
      <header className="h-16 border-b-2 border-on-surface flex items-center justify-between px-6 bg-surface-container-lowest z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">Study Center</h2>
          <div className="h-6 w-0.5 bg-on-surface/20"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface rounded-full border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface">Focus Mode Active</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {lastReviewedCardId && sessionCount > 0 && (
             <button 
               onClick={handleUndo}
               disabled={undoLoading}
               className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-on-surface rounded-lg bg-surface text-sm font-bold text-on-surface shadow-[2px_2px_0px_0px_#191b23] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50"
             >
               {undoLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={3} /> : <Undo2 size={14} strokeWidth={3} />}
               UNDO LAST
             </button>
          )}
          <div className="px-3 py-1.5 bg-primary/10 border-2 border-on-surface rounded-lg text-sm font-bold text-primary flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#191b23]">
            <TrendingUp size={14} strokeWidth={3} />
            STABILITY: {currentCard.stability.toFixed(1)}D
          </div>
        </div>
      </header>

      {/* Main Study Zone */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 lg:p-8">
        
        {/* Progress Header */}
        <div className="w-full max-w-2xl flex justify-between items-end mb-4 shrink-0">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Session Progress</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-on-surface">{currentIndex + 1}</span>
              <span className="text-on-surface-variant font-bold text-sm">/ {cards.length} CARDS</span>
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
            <div className="flashcard-face absolute inset-0 bg-surface-container-lowest border-2 border-on-surface shadow-[8px_8px_0px_0px_#191b23] rounded-xl flex flex-col overflow-hidden">
              <div className="px-6 py-4 flex justify-between items-center border-b-2 border-on-surface bg-secondary text-white">
                <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Brain size={16} strokeWidth={2.5} />
                  <span className="truncate max-w-[200px]">{currentCard.topic_name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-surface text-on-surface px-2 py-1 border-2 border-on-surface rounded shadow-[2px_2px_0px_0px_#191b23]">
                    {currentCard.concept_type}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-1 border-2 border-on-surface rounded shadow-[2px_2px_0px_0px_#191b23]">
                    {['New', 'Learning', 'Review', 'Relearning'][currentCard.state] || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 overflow-y-auto custom-scrollbar">
                <div className="prose prose-slate max-w-none prose-p:font-sans prose-p:font-bold prose-p:text-xl prose-p:leading-snug prose-p:text-on-surface prose-headings:font-bold prose-headings:text-on-surface">
                  <MarkdownRenderer content={currentCard.question} />
                </div>
                <div className="mt-8 flex items-center gap-2 text-on-surface-variant animate-pulse opacity-70">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-surface px-2 py-1 border-2 border-on-surface rounded shadow-[2px_2px_0px_0px_#191b23]">SPACE</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">or TAP TO REVEAL</span>
                </div>
              </div>
            </div>

            {/* Back of Card */}
            <div className="flashcard-face flashcard-back absolute inset-0 bg-surface-container-lowest border-2 border-on-surface shadow-[8px_8px_0px_0px_#191b23] rounded-xl flex flex-col overflow-hidden">
              <div className="px-6 py-4 flex justify-between items-center border-b-2 border-on-surface bg-primary text-white">
                <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  ANSWER REVEALED
                </span>
                <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                  RATE YOUR MEMORY BELOW
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 overflow-y-auto custom-scrollbar bg-primary/5">
                <div className="prose prose-slate max-w-none prose-p:font-sans prose-p:font-bold prose-p:text-xl prose-p:leading-snug prose-p:text-on-surface prose-headings:font-bold prose-headings:text-on-surface">
                  <MarkdownRenderer content={currentCard.answer} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Study Controls */}
        <div className={clsx(
          "w-full max-w-2xl grid grid-cols-4 gap-4 transition-all duration-300 shrink-0",
          !isFlipped && "opacity-20 pointer-events-none grayscale"
        )}>
          <button 
            onClick={() => handleRate(1)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-surface hover:bg-error/10 text-error border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer group"
          >
            <span className="text-lg font-bold uppercase pointer-events-none">Again</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">&lt; 1m</span>
          </button>

          <button 
            onClick={() => handleRate(2)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-surface hover:bg-orange-500/10 text-orange-600 border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer group"
          >
            <span className="text-lg font-bold uppercase pointer-events-none">Hard</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 5m</span>
          </button>

          <button 
            onClick={() => handleRate(3)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-surface hover:bg-primary/10 text-primary border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer group"
          >
            <span className="text-lg font-bold uppercase pointer-events-none">Good</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 10m</span>
          </button>

          <button 
            onClick={() => handleRate(4)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-surface hover:bg-green-600/10 text-green-700 border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer group"
          >
            <span className="text-lg font-bold uppercase pointer-events-none">Easy</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 4d</span>
          </button>
        </div>

      </div>
    </div>
  );
}
