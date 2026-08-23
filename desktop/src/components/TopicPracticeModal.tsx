import { useState, useEffect, useRef } from 'react';
import { client, type Flashcard } from '../api/client';
import { Brain, Check, X, TrendingUp, HelpCircle } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';


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
    setState('answer');
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
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-surface relative min-h-0">
          
          <div className="bg-surface-container-lowest border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] overflow-hidden flex flex-col relative transition-all duration-300">
            {/* Context Breadcrumb */}
            <div className="bg-surface border-b-2 border-on-surface px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface">
                <Brain size={14} strokeWidth={2} className="text-primary" />
                <span className="truncate max-w-[150px]">{currentCard.topic_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-on-surface font-black uppercase tracking-widest bg-surface-container px-2 py-1 border-2 border-on-surface rounded shadow-[2px_2px_0px_0px_#191b23]">
                  {currentCard.concept_type}
                </div>
                <div className="text-[10px] text-white font-black uppercase tracking-widest bg-secondary px-2 py-1 border-2 border-on-surface rounded shadow-[2px_2px_0px_0px_#191b23]">
                  {['New', 'Learning', 'Review', 'Relearning'][currentCard.state] || 'Unknown'}
                </div>
              </div>
            </div>

            {/* Question */}
            <div className="p-6">
              <div className="inline-block px-3 py-1 bg-secondary text-white text-xs font-bold uppercase tracking-wider rounded-md border-2 border-on-surface mb-4 shadow-[2px_2px_0px_0px_#191b23]">
                Question
              </div>
              <div className="prose prose-slate max-w-none text-on-surface text-lg font-bold leading-relaxed">
                <MarkdownRenderer content={currentCard.question} />
              </div>
            </div>

            {/* Answer Section */}
            {state === 'answer' && (
              <div ref={answerRef} className="p-6 bg-primary/5 border-t-2 border-on-surface animate-in fade-in duration-300">
                <div className="inline-block px-3 py-1 bg-surface-container-lowest text-on-surface text-xs font-bold uppercase tracking-wider rounded-md border-2 border-on-surface mb-4 shadow-[2px_2px_0px_0px_#191b23]">
                  Answer
                </div>
                <div className="prose prose-slate max-w-none text-on-surface text-base font-medium leading-relaxed">
                  <MarkdownRenderer content={currentCard.answer} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 pt-4 border-t-2 border-on-surface bg-surface-container-lowest shrink-0">
          {state === 'question' ? (
            <button 
              onClick={handleShowAnswer}
              className="w-full bg-primary text-white text-lg uppercase tracking-wider font-bold py-4 rounded-xl border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
            >
              Show Answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => handleRate(1)} className="bg-surface hover:bg-error/10 border-2 border-on-surface text-error font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group">
                <span className="text-lg uppercase pointer-events-none">Again</span>
                <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">&lt; 1m</span>
              </button>
              <button onClick={() => handleRate(2)} className="bg-surface hover:bg-orange-500/10 border-2 border-on-surface text-orange-600 font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group">
                <span className="text-lg uppercase pointer-events-none">Hard</span>
                <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 5m</span>
              </button>
              <button onClick={() => handleRate(3)} className="bg-surface hover:bg-primary/10 border-2 border-on-surface text-primary font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group">
                <span className="text-lg uppercase pointer-events-none">Good</span>
                <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 10m</span>
              </button>
              <button onClick={() => handleRate(4)} className="bg-surface hover:bg-green-600/10 border-2 border-on-surface text-green-700 font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#191b23] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex flex-col items-center justify-center group">
                <span className="text-lg uppercase pointer-events-none">Easy</span>
                <span className="text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider opacity-70 group-hover:opacity-100 pointer-events-none">~ 4d</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
