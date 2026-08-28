import { useState, useEffect, useRef } from 'react';
import { client, type Flashcard } from '../api/client';
import { Brain, Check, X, TrendingUp, HelpCircle } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import clsx from 'clsx';


interface TopicPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: number;
  topicName: string;
  cards: Flashcard[];
}

type ReviewState = 'question' | 'answer' | 'done';

export function TopicPracticeModal({ isOpen, onClose, topicId, topicName, cards: initialCards }: TopicPracticeModalProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<ReviewState>('question');
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCards(initialCards);
      setCurrentIndex(0);
      setState(initialCards.length > 0 ? 'question' : 'done');
      setSessionCount(0);
    }
  }, [isOpen, initialCards]);

  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === 'answer' && answerRef.current) {
      setTimeout(() => {
        answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [state]);

  if (!isOpen) return null;

  const handleShowAnswer = () => {
    if (state === 'question') {
      setState('answer');
    } else if (state === 'answer') {
      setState('question');
    }
  };

  const handleRate = async (rating: number) => {
    const currentCard = cards[currentIndex];
    
    try {
      await client.submitReview(currentCard.id, rating);
      setSessionCount(prev => prev + 1);
      
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(currentIndex + 1);
        setState('question');
      } else {
        setState('done');
      }
    } catch (err) {
      console.error("Failed to submit review", err);
      alert(`Failed to submit review. Is the backend running properly? Error: ${err}`);
    }
  };

  if (state === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-surface-container-lowest border-2 border-on-surface shadow-[8px_8px_0px_0px_#191b23] w-full max-w-md rounded-xl flex flex-col items-center justify-center relative p-10">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-on-surface bg-surface border-2 border-on-surface hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] p-2 rounded-lg transition-all duration-200 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <X size={20} strokeWidth={2} />
          </button>
          
          <div className="w-20 h-20 bg-secondary text-white rounded-full flex items-center justify-center mb-6 border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23]">
            <Check size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black text-on-surface tracking-tight mb-3 uppercase">Topic Finished!</h2>
          <p className="text-on-surface-variant max-w-md text-center text-sm font-medium">
            You've completed the practice session for <strong className="text-primary">{topicName}</strong>.
          </p>
          
          <div className="mt-8 bg-surface-container-lowest border-2 border-on-surface rounded-xl p-6 w-full shadow-[4px_4px_0px_0px_#191b23]">
            <h3 className="text-on-surface font-bold mb-4 uppercase tracking-wider text-sm">Session Stats</h3>
            <div className="flex justify-between items-center bg-surface px-4 py-3 rounded-lg border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]">
              <span className="text-on-surface-variant font-bold text-sm">Cards Reviewed</span>
              <span className="text-primary font-black text-xl">{sessionCount}</span>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-8 w-full px-6 py-4 bg-primary text-white border-2 border-on-surface rounded-xl font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
          >
            Return to Topic
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  if (!currentCard) return null;

  const isFlipped = state === 'answer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest border-2 border-on-surface shadow-[8px_8px_0px_0px_#191b23] w-full max-w-3xl h-[85vh] rounded-xl flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-on-surface flex items-center justify-between bg-surface-container-lowest shrink-0">
          <div>
            <h2 className="text-lg font-black text-on-surface tracking-tight flex items-center gap-2 uppercase">
              Practice Session
              <span className="group relative inline-flex">
                <HelpCircle size={16} className="text-on-surface-variant cursor-help" strokeWidth={2} />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-surface-container-lowest text-on-surface text-xs font-medium px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center shadow-[4px_4px_0px_0px_#191b23] border-2 border-on-surface z-50">
                  Rate your recall honestly to let FSRS schedule the next review optimally.
                </span>
              </span>
            </h2>
            <p className="text-on-surface-variant font-bold text-xs mt-1 uppercase tracking-wider">Reviewing {currentIndex + 1} of {cards.length}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-surface border-2 border-on-surface px-3 py-1 rounded-md shadow-[2px_2px_0px_0px_#191b23] flex items-center gap-2 text-xs font-bold text-on-surface uppercase">
              <TrendingUp size={14} className="text-primary" strokeWidth={2} />
              Stability: {currentCard.stability.toFixed(1)}d
            </div>
            <button 
              onClick={onClose}
              className="text-on-surface bg-surface hover:bg-surface-container border-2 border-on-surface rounded-lg shadow-[2px_2px_0px_0px_#191b23] p-2 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-surface relative min-h-0 items-center justify-center">
          
          {/* 3D Flashcard Container */}
          <div className="relative w-full max-w-2xl min-h-[320px] h-[45vh] max-h-[450px] group shrink-0">
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
                    <span className="text-[10px] font-black uppercase tracking-widest bg-surface-container text-on-surface px-2 py-1 border-2 border-on-surface rounded shadow-[2px_2px_0px_0px_#191b23]">
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
        </div>

        {/* Controls */}
        <div className="p-6 pt-4 border-t-2 border-on-surface bg-surface-container-lowest shrink-0 flex justify-center">
          <div className={clsx(
            "w-full max-w-2xl grid grid-cols-4 gap-4 transition-all duration-300",
            !isFlipped && "opacity-20 pointer-events-none grayscale"
          )}>
            <button 
              onClick={() => handleRate(1)} 
              disabled={!isFlipped}
              className="bg-surface hover:bg-error/10 border-2 border-on-surface text-error font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group"
            >
              <span className="text-lg uppercase pointer-events-none">Again</span>
              <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">&lt; 1m</span>
            </button>
            <button 
              onClick={() => handleRate(2)} 
              disabled={!isFlipped}
              className="bg-surface hover:bg-orange-500/10 border-2 border-on-surface text-orange-600 font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group"
            >
              <span className="text-lg uppercase pointer-events-none">Hard</span>
              <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 5m</span>
            </button>
            <button 
              onClick={() => handleRate(3)} 
              disabled={!isFlipped}
              className="bg-surface hover:bg-primary/10 border-2 border-on-surface text-primary font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group"
            >
              <span className="text-lg uppercase pointer-events-none">Good</span>
              <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 10m</span>
            </button>
            <button 
              onClick={() => handleRate(4)} 
              disabled={!isFlipped}
              className="bg-surface hover:bg-green-600/10 border-2 border-on-surface text-green-700 font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group"
            >
              <span className="text-lg uppercase pointer-events-none">Easy</span>
              <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 4d</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
