import { useState, useEffect } from 'react';
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
    }
  };

  if (state === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-surface-container-lowest border border-border-default shadow-[var(--shadow-lg)] w-full h-full md:w-3/4 md:h-3/4 md:rounded-[var(--radius-large)] flex flex-col items-center justify-center relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-surface-container transition-all duration-200"
          >
            <X size={24} strokeWidth={1.5} />
          </button>
          
          <div className="w-20 h-20 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center mb-6 border border-accent-blue/20">
            <Check size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-bold text-primary tracking-tight mb-3">Topic Finished!</h2>
          <p className="text-on-surface-variant max-w-md text-center text-lg">
            You've completed the practice session for <strong className="text-primary">{topicName}</strong>.
          </p>
          
          <div className="mt-8 bg-surface-container-low border border-border-default rounded-[var(--radius-large)] p-6 w-full max-w-sm">
            <h3 className="text-primary font-semibold mb-4">Session Stats</h3>
            <div className="flex justify-between items-center bg-surface-container px-4 py-3 rounded-[var(--radius-standard)] border border-border-default">
              <span className="text-on-surface-variant">Cards Reviewed</span>
              <span className="text-accent-blue font-bold text-xl">{sessionCount}</span>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-8 px-6 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-[var(--radius-standard)] font-medium transition-all duration-200"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-border-default shadow-[var(--shadow-lg)] w-full h-full md:w-3/4 md:h-[85vh] md:rounded-[var(--radius-large)] flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border-default flex items-center justify-between bg-surface-container-low">
          <div>
            <h2 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
              Practice Session
              <span className="group relative inline-flex">
                <HelpCircle size={16} className="text-on-surface-variant cursor-help" strokeWidth={1.5} />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-surface-container-low text-on-surface text-xs px-3 py-2 rounded-[var(--radius-standard)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center shadow-[var(--shadow-default)] border border-border-default">
                  Rate your recall honestly to let FSRS schedule the next review optimally.
                </span>
              </span>
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">Reviewing {currentIndex + 1} of {cards.length}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-surface-container border border-border-default px-3 py-1.5 rounded-full shadow-[var(--shadow-sm)] flex items-center gap-2 text-xs font-medium text-on-surface">
              <TrendingUp size={14} className="text-accent-blue" strokeWidth={1.5} />
              Stability: {currentCard.stability.toFixed(1)} days
            </div>
            <button 
              onClick={onClose}
              className="text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-surface-container transition-all duration-200 bg-surface-container border border-border-default"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-12 shrink-0 min-h-full flex flex-col relative overflow-hidden transition-all duration-500">
            
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
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out pb-8">
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
          </div>
        </div>

        {/* Controls */}
        <div className="p-8 pt-0 mt-auto">
          {state === 'question' ? (
            <button 
              onClick={handleShowAnswer}
              className="w-full bg-accent-blue hover:bg-secondary-container text-white text-xl font-bold py-5 rounded-[var(--radius-large)] shadow-[var(--shadow-default)] transition-all duration-200"
            >
              Show Answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => handleRate(1)} className="bg-surface-container-low hover:bg-error/5 border border-border-default hover:border-error/50 text-error font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
                <span className="text-lg">Again</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">&lt; 1m</span>
              </button>
              <button onClick={() => handleRate(2)} className="bg-surface-container-low hover:bg-orange-500/5 border border-border-default hover:border-orange-500/50 text-orange-600 font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
                <span className="text-lg">Hard</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 5m</span>
              </button>
              <button onClick={() => handleRate(3)} className="bg-surface-container-low hover:bg-accent-blue/5 border border-border-default hover:border-accent-blue/50 text-accent-blue font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
                <span className="text-lg">Good</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">~ 10m</span>
              </button>
              <button onClick={() => handleRate(4)} className="bg-surface-container-low hover:bg-green-500/5 border border-border-default hover:border-green-500/50 text-green-600 font-semibold py-4 rounded-[var(--radius-large)] transition-all duration-200 flex flex-col items-center gap-1 group">
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
