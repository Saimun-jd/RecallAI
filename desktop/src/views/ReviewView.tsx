import { useEffect, useState } from 'react';
import { client, type Flashcard } from '../api/client';
import { Loader2, Brain, Check, X, RotateCcw, TrendingUp, Undo2, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

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
    setState('answer');
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

  if (state === 'loading') {
    return <div className="p-8 flex justify-center h-full items-center"><Loader2 className="animate-spin text-emerald-500 w-8 h-8" /></div>;
  }

  if (state === 'done') {
    return (
      <div className="p-8 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center h-full">
        <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] border border-emerald-500/20">
          <Check size={48} />
        </div>
        <h2 className="text-3xl font-bold text-zinc-100 tracking-tight mb-3">You're all caught up!</h2>
        <p className="text-zinc-400 max-w-md text-lg">
          You have no more cards to review right now.
        </p>
        
        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
          <h3 className="text-zinc-300 font-semibold mb-4">Session Stats</h3>
          <div className="flex justify-between items-center bg-zinc-950 px-4 py-3 rounded-lg border border-zinc-800/50">
            <span className="text-zinc-500">Cards Reviewed</span>
            <span className="text-emerald-400 font-bold text-xl">{sessionCount}</span>
          </div>
        </div>
        
        <button 
          onClick={fetchDueCards}
          className="mt-8 flex items-center gap-2 text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
        >
          <RotateCcw size={16} /> Check again
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="p-8 max-w-3xl mx-auto flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            Study Session
            {sessionCount === 0 && (
              <span className="group relative inline-flex">
                <HelpCircle size={16} className="text-zinc-500 cursor-help" />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-zinc-800 text-zinc-200 text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center shadow-xl border border-zinc-700">
                  Rate your recall honestly to let FSRS schedule the next review optimally.
                </span>
              </span>
            )}
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Reviewing {currentIndex + 1} of {cards.length}</p>
        </div>
        <div className="flex items-center gap-4">
          {lastReviewedCardId && sessionCount > 0 && (
             <button 
               onClick={handleUndo}
               disabled={undoLoading}
               className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
             >
               {undoLoading ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
               Undo Last
             </button>
          )}
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-sm font-medium text-zinc-300">
            <TrendingUp size={16} className="text-emerald-500" />
            Stability: {currentCard.stability.toFixed(1)} days
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col mb-12">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-xl p-8 md:p-12 min-h-[400px] flex flex-col relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0"></div>

          {/* Context Breadcrumb */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-500/80 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <Brain size={14} />
              {currentCard.topic_name}
            </div>
            
            <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest border border-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              ☁️ Cloud
            </div>
          </div>

          {/* Question */}
          <div className="text-2xl text-zinc-100 font-medium mb-8 leading-relaxed">
            {currentCard.question}
          </div>

          {/* Divider */}
          {state === 'answer' && (
            <div className="w-full border-t border-zinc-800 my-8 relative">
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-zinc-900 px-4 text-xs text-zinc-500 font-semibold tracking-widest uppercase">
                Answer
              </div>
            </div>
          )}

          {/* Answer */}
          {state === 'answer' && (
            <div className="text-lg text-zinc-300 leading-relaxed font-serif">
              {currentCard.answer}
            </div>
          )}
          
          <div className="flex-1"></div>
        </div>

        {/* Controls */}
        <div className="mt-8 px-4">
          {state === 'question' ? (
            <button 
              onClick={handleShowAnswer}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xl font-bold py-5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
            >
              Show Answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => handleRate(1)} className="bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/50 text-red-400 hover:text-red-300 font-semibold py-4 rounded-2xl transition-all flex flex-col items-center gap-1 group">
                <span className="text-lg">Again</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">&lt; 1m</span>
              </button>
              <button onClick={() => handleRate(2)} className="bg-zinc-900 hover:bg-orange-500/10 border border-zinc-800 hover:border-orange-500/50 text-orange-400 hover:text-orange-300 font-semibold py-4 rounded-2xl transition-all flex flex-col items-center gap-1 group">
                <span className="text-lg">Hard</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 5m</span>
              </button>
              <button onClick={() => handleRate(3)} className="bg-zinc-900 hover:bg-emerald-500/10 border border-zinc-800 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 font-semibold py-4 rounded-2xl transition-all flex flex-col items-center gap-1 group">
                <span className="text-lg">Good</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 10m</span>
              </button>
              <button onClick={() => handleRate(4)} className="bg-zinc-900 hover:bg-cyan-500/10 border border-zinc-800 hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300 font-semibold py-4 rounded-2xl transition-all flex flex-col items-center gap-1 group">
                <span className="text-lg">Easy</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 4d</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
