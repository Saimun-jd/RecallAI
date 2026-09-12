import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, Brain, ArrowRight, Upload, Key, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    setIsClosing(true);
    setTimeout(onComplete, 300);
  };

  const handleConfigureKeys = () => {
    setIsClosing(true);
    setTimeout(() => {
      onComplete();
      navigate('/settings');
    }, 300);
  };

  const features = [
    {
      icon: <Upload className="text-primary" size={24} />,
      title: "Intelligent PDF Ingestion",
      description: "Import textbooks and research papers with automatic table-of-contents extraction."
    },
    {
      icon: <Sparkles className="text-accent-blue" size={24} />,
      title: "Granular Topic Chunks",
      description: "AI-powered segmentation divides dense chapters into atomic, digestible concepts."
    },
    {
      icon: <Brain className="text-primary" size={24} />,
      title: "Spaced Repetition & Socratic Drills",
      description: "Retain key insights effortlessly with modern FSRS algorithms and interactive tutoring."
    }
  ];

  return (
    <div 
      className={clsx(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300",
        isVisible && !isClosing ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div 
        className={clsx(
          "bg-surface-container-lowest border border-border-default shadow-xl rounded-2xl max-w-3xl w-full mx-4 p-8 max-h-[90vh] overflow-y-auto custom-scrollbar transition-all duration-300 transform",
          isVisible && !isClosing ? "translate-y-0 scale-100" : "translate-y-6 scale-98"
        )}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-4 border border-primary/20 shadow-xs">
            <BookOpen size={28} />
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2 tracking-tight">
            Welcome to Recall AI
          </h1>
          <p className="text-base text-on-surface-variant max-w-lg mx-auto">
            Your focused knowledge workspace for reading, understanding, and permanently mastering complex material.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {features.map((feature, idx) => (
            <div 
              key={idx} 
              className="bg-surface-container-low/60 border border-border-default/80 rounded-xl p-5 transition-all hover:bg-surface-container-low hover:border-border-default hover:shadow-xs"
            >
              <div className="mb-3 p-2 bg-surface-container-lowest rounded-lg inline-block border border-border-default shadow-2xs">
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-on-surface mb-1.5">{feature.title}</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* API Key Guidance Box */}
        <div className="bg-surface-container-low/80 border border-border-default rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20 shrink-0 mt-0.5 sm:mt-0">
              <Key size={20} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-on-surface">LLM Provider Configuration</h4>
              <p className="text-on-surface-variant text-xs mt-0.5">
                Connect Google Gemini, OpenAI, or local Ollama to enable AI topic summaries and flashcard generation.
              </p>
            </div>
          </div>
          <button
            onClick={handleConfigureKeys}
            className="shrink-0 text-xs font-semibold text-primary hover:text-accent-blue bg-surface-container-lowest border border-border-default hover:bg-surface-container px-3.5 py-2 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
          >
            Configure Keys <ArrowRight size={14} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-default/60">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 bg-primary text-on-primary font-semibold text-sm px-6 py-2.5 rounded-lg shadow-sm hover:bg-primary/90 hover:shadow transition-all"
          >
            <span>Open Library</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
