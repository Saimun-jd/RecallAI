import { useEffect, useState, useRef } from 'react';
import { client, type Flashcard } from '../api/client';
import { Loader2, Brain, Check, X, RotateCcw, TrendingUp, Undo2, HelpCircle } from 'lucide-react';
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
  
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === 'answer' && answerRef.current) {
      setTimeout(() => {
        answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [state]);

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
    return <div className="p-8 flex justify-center h-full items-center bg-surface"><Loader2 className="animate-spin text-accent-blue w-8 h-8" strokeWidth={1.5} /></div>;
  }

  if (state === 'done') {
    return (
      <div className="p-8 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center h-full bg-surface">
        <div className="w-24 h-24 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center mb-6 shadow-[var(--shadow-default)] border border-accent-blue/20">
          <Check size={48} strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-semibold text-primary tracking-tight mb-3">You're all caught up!</h2>
        <p className="text-on-surface-variant max-w-md text-lg">
          You have no more cards to review right now.
        </p>
        
        <div className="mt-8 bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] p-6 w-full max-w-sm shadow-[var(--shadow-default)]">
          <h3 className="text-primary font-semibold mb-4">Session Stats</h3>
          <div className="flex justify-between items-center bg-surface-container px-4 py-3 rounded-[var(--radius-standard)] border border-outline-variant">
            <span className="text-on-surface-variant font-medium">Cards Reviewed</span>
            <span className="text-accent-blue font-bold text-xl">{sessionCount}</span>
          </div>
        </div>
        
        <button 
          onClick={fetchDueCards}
          className="mt-8 flex items-center gap-2 text-on-surface-variant hover:text-primary font-medium transition-colors duration-200"
        >
          <RotateCcw size={16} strokeWidth={1.5} /> Check again
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="p-8 max-w-3xl mx-auto flex flex-col h-full overflow-y-auto bg-surface">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-primary tracking-tight flex items-center gap-2">
            Study Session
            {sessionCount === 0 && (
              <span className="group relative inline-flex">
                <HelpCircle size={16} className="text-on-surface-variant cursor-help" strokeWidth={1.5} />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-surface-container-highest text-primary text-xs px-3 py-2 rounded-[var(--radius-standard)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center shadow-[var(--shadow-default)] border border-border-default">
                  Rate your recall honestly to let FSRS schedule the next review optimally.
                </span>
              </span>
            )}
          </h2>
          <p className="text-on-surface-variant text-sm mt-1 font-medium">Reviewing {currentIndex + 1} of {cards.length}</p>
        </div>
        <div className="flex items-center gap-4">
          {lastReviewedCardId && sessionCount > 0 && (
             <button 
               onClick={handleUndo}
               disabled={undoLoading}
               className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors duration-200 disabled:opacity-50"
             >
               {undoLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <Undo2 size={14} strokeWidth={1.5} />}
               Undo Last
             </button>
          )}
          <div className="bg-surface-container-lowest border border-border-default px-4 py-2 rounded-full shadow-[var(--shadow-default)] flex items-center gap-2 text-sm font-medium text-primary">
            <TrendingUp size={16} className="text-accent-blue" strokeWidth={1.5} />
            Stability: {currentCard.stability.toFixed(1)} days
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col mb-12">
        <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-12 min-h-[400px] flex flex-col relative overflow-hidden transition-all duration-500">
          
          {/* Context Breadcrumb */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent-blue bg-blue-50/50 px-3 py-1.5 rounded-full">
              <Brain size={14} strokeWidth={1.5} />
              {currentCard.topic_name}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-full">
                {currentCard.concept_type}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full">
                {['New', 'Learning', 'Review', 'Relearning'][currentCard.state] || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="prose prose-slate prose-lg max-w-none mb-8 font-serif text-slate-800 leading-relaxed">
            <MarkdownRenderer content={currentCard.question} />
          </div>

          {/* Answer Section */}
          {state === 'answer' && (
            <div ref={answerRef} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out">
              {/* Elegant Divider */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-10 relative flex justify-center items-center">
                <div className="bg-white px-4 flex gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                </div>
              </div>

              {/* Answer Text */}
              <div className="prose prose-slate max-w-none text-slate-700">
                <MarkdownRenderer content={currentCard.answer} />
              </div>
            </div>
          )}
          
          <div className="flex-1"></div>
        </div>

        {/* Controls */}
        <div className="mt-8 px-4">
          {state === 'question' ? (
            <button 
              onClick={handleShowAnswer}
              className="w-full bg-accent-blue hover:bg-accent-blue/90 text-white text-xl font-bold py-5 rounded-[var(--radius-large)] shadow-[var(--shadow-default)] hover:shadow-[var(--shadow-md)] transition-all duration-200"
            >
              Show Answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => handleRate(1)} className="bg-surface-container-lowest hover:bg-error/10 border border-border-default hover:border-error/50 text-error hover:text-error/80 font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
                <span className="text-lg">Again</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">&lt; 1m</span>
              </button>
              <button onClick={() => handleRate(2)} className="bg-surface-container-lowest hover:bg-amber-500/10 border border-border-default hover:border-amber-500/50 text-amber-600 hover:text-amber-500 font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
                <span className="text-lg">Hard</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 5m</span>
              </button>
              <button onClick={() => handleRate(3)} className="bg-surface-container-lowest hover:bg-accent-blue/10 border border-border-default hover:border-accent-blue/50 text-accent-blue hover:text-accent-blue/80 font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
                <span className="text-lg">Good</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 10m</span>
              </button>
              <button onClick={() => handleRate(4)} className="bg-surface-container-lowest hover:bg-cyan-500/10 border border-border-default hover:border-cyan-500/50 text-cyan-600 hover:text-cyan-500 font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
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
