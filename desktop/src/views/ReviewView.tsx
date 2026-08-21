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
        <div className="w-full max-w-lg bg-surface-container-lowest border-4 border-primary p-12 text-center neo-shadow-lg flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-secondary border-4 border-primary text-white rounded-full flex items-center justify-center neo-shadow">
            <Check size={48} strokeWidth={4} />
          </div>
          <h2 className="text-4xl font-black text-primary uppercase tracking-tight">You're all caught up!</h2>
          <p className="text-on-surface-variant font-medium text-lg">
            No more cards to review right now.
          </p>
          
          <div className="w-full mt-4 p-4 border-4 border-primary bg-primary-container text-on-primary-container flex justify-between items-center neo-shadow">
            <span className="font-bold uppercase tracking-wider text-sm">Session Stats</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Cards Reviewed:</span>
              <span className="bg-secondary text-white px-3 py-1 font-black rounded-sm border-2 border-primary">{sessionCount}</span>
            </div>
          </div>
          
          <button 
            onClick={fetchDueCards}
            className="w-full mt-4 py-4 bg-primary text-white font-black uppercase text-xl border-4 border-primary neo-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
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
      <header className="h-20 border-b-4 border-primary flex items-center justify-between px-8 bg-surface-container-lowest z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Study Center</h2>
          <div className="h-6 w-1 bg-outline-variant"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border-2 border-primary">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Focus Mode Active</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {lastReviewedCardId && sessionCount > 0 && (
             <button 
               onClick={handleUndo}
               disabled={undoLoading}
               className="flex items-center gap-2 px-4 py-2 border-4 border-primary bg-surface-container-lowest font-bold text-primary neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
             >
               {undoLoading ? <Loader2 size={16} className="animate-spin" strokeWidth={3} /> : <Undo2 size={16} strokeWidth={3} />}
               UNDO LAST
             </button>
          )}
          <div className="px-4 py-2 bg-secondary-container border-4 border-primary font-bold text-on-secondary-container flex items-center gap-2 neo-shadow-sm">
            <TrendingUp size={18} strokeWidth={3} />
            STABILITY: {currentCard.stability.toFixed(1)}D
          </div>
        </div>
      </header>

      {/* Main Study Zone */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 lg:p-12">
        
        {/* Progress Header */}
        <div className="w-full max-w-[800px] flex justify-between items-end mb-8 shrink-0">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Session Progress</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-primary">{currentIndex + 1}</span>
              <span className="text-on-surface-variant font-bold">/ {cards.length} CARDS</span>
            </div>
          </div>
        </div>

        {/* 3D Flashcard Container */}
        <div className="relative w-full max-w-[800px] aspect-[1.5/1] min-h-[400px] group mb-12 shrink-0">
          <div className={clsx(
            "flashcard-inner w-full h-full relative cursor-pointer",
            isFlipped && "flashcard-flipped"
          )} onClick={handleShowAnswer}>
            
            {/* Front of Card */}
            <div className="flashcard-face absolute inset-0 bg-surface-container-lowest border-4 border-primary neo-shadow-lg flex flex-col overflow-hidden">
              <div className="p-8 flex justify-between items-center border-b-4 border-primary bg-primary-container text-on-primary-container">
                <span className="text-sm font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                  <Brain size={18} strokeWidth={3} />
                  {currentCard.topic_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest bg-surface-container-highest text-primary px-3 py-1 border-2 border-primary">
                    {currentCard.concept_type}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-3 py-1 border-2 border-primary">
                    {['New', 'Learning', 'Review', 'Relearning'][currentCard.state] || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-12 overflow-y-auto custom-scrollbar">
                <div className="prose prose-lg max-w-none prose-p:font-sans prose-p:font-bold prose-p:text-2xl prose-p:leading-tight prose-p:text-primary prose-headings:font-bold prose-headings:text-primary">
                  <MarkdownRenderer content={currentCard.question} />
                </div>
                <div className="mt-12 flex items-center gap-2 text-on-surface-variant animate-pulse opacity-70">
                  <span className="text-sm font-bold uppercase tracking-widest bg-surface-container-high px-3 py-1 border-2 border-outline-variant rounded-md">SPACE</span>
                  <span className="font-bold">or TAP TO REVEAL</span>
                </div>
              </div>
            </div>

            {/* Back of Card */}
            <div className="flashcard-face flashcard-back absolute inset-0 bg-surface-container-lowest border-4 border-primary neo-shadow-lg flex flex-col overflow-hidden">
              <div className="p-8 flex justify-between items-center border-b-4 border-primary bg-secondary-fixed text-on-secondary-fixed">
                <span className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  ANSWER REVEALED
                </span>
                <span className="text-xs font-bold opacity-70">
                  RATE YOUR MEMORY BELOW
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-center p-12 overflow-y-auto custom-scrollbar">
                <div className="prose prose-lg max-w-none prose-p:font-sans prose-p:font-bold prose-p:text-2xl prose-p:leading-tight prose-p:text-primary prose-headings:font-bold prose-headings:text-primary">
                  <MarkdownRenderer content={currentCard.answer} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Study Controls */}
        <div className={clsx(
          "w-full max-w-[800px] grid grid-cols-4 gap-6 transition-all duration-300 shrink-0",
          !isFlipped && "opacity-20 pointer-events-none grayscale"
        )}>
          <button 
            onClick={() => handleRate(1)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-2 p-6 bg-error-container text-on-error-container border-4 border-primary neo-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
          >
            <span className="text-xs font-black opacity-60 bg-white/50 px-2 py-0.5 rounded-sm mb-1 border-2 border-primary/30">1</span>
            <span className="text-2xl font-black uppercase">Again</span>
            <span className="text-sm font-bold opacity-80">&lt; 1m</span>
          </button>

          <button 
            onClick={() => handleRate(2)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-2 p-6 bg-amber-200 text-amber-900 border-4 border-primary neo-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
          >
            <span className="text-xs font-black opacity-60 bg-white/50 px-2 py-0.5 rounded-sm mb-1 border-2 border-primary/30">2</span>
            <span className="text-2xl font-black uppercase">Hard</span>
            <span className="text-sm font-bold opacity-80">~ 5m</span>
          </button>

          <button 
            onClick={() => handleRate(3)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-2 p-6 bg-secondary-fixed text-on-secondary-fixed border-4 border-primary neo-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
          >
            <span className="text-xs font-black opacity-60 bg-white/50 px-2 py-0.5 rounded-sm mb-1 border-2 border-primary/30">3</span>
            <span className="text-2xl font-black uppercase">Good</span>
            <span className="text-sm font-bold opacity-80">~ 10m</span>
          </button>

          <button 
            onClick={() => handleRate(4)}
            disabled={!isFlipped}
            className="flex flex-col items-center justify-center gap-2 p-6 bg-cyan-200 text-cyan-900 border-4 border-primary neo-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
          >
            <span className="text-xs font-black opacity-60 bg-white/50 px-2 py-0.5 rounded-sm mb-1 border-2 border-primary/30">4</span>
            <span className="text-2xl font-black uppercase">Easy</span>
            <span className="text-sm font-bold opacity-80">~ 4d</span>
          </button>
        </div>

      </div>
    </div>
  );
}
