import { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Brain, ArrowRight, Upload, Key } from 'lucide-react';
import clsx from 'clsx';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Fade in effect on mount
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    setIsClosing(true);
    setTimeout(onComplete, 400); // Wait for fade out animation
  };

  const features = [
    {
      icon: <Upload className="text-primary" size={32} />,
      title: "Upload PDFs",
      description: "Seamlessly import your textbooks, notes, and documents."
    },
    {
      icon: <Sparkles className="text-primary" size={32} />,
      title: "AI-Powered Chunks",
      description: "Our AI automatically breaks down large documents into digestible topics."
    },
    {
      icon: <Brain className="text-primary" size={32} />,
      title: "Spaced Repetition",
      description: "Generate flashcards and retain knowledge forever with FSRS."
    }
  ];

  return (
    <div 
      className={clsx(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-500",
        isVisible && !isClosing ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div 
        className={clsx(
          "bg-surface border-2 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl max-w-4xl w-full mx-4 p-6 md:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar transition-all duration-500 transform",
          isVisible && !isClosing ? "translate-y-0 scale-100" : "translate-y-12 scale-95"
        )}
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 border-[3px] border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-3 transition-transform hover:rotate-3">
            <BookOpen size={32} className="text-on-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-3 tracking-tight">
            Welcome to <span className="text-primary relative inline-block">Recall<div className="absolute -bottom-2 left-0 right-0 h-3 bg-surface-container-highest -z-10 -rotate-2 rounded-full"></div></span>
          </h1>
          <p className="text-base text-on-surface-variant max-w-xl mx-auto">
            Your intelligent study companion. Turn overwhelming documents into masterable concepts in seconds.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {features.map((feature, idx) => (
            <div 
              key={idx} 
              className="bg-surface-container-low border-2 border-on-surface rounded-xl p-5 transition-transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="mb-3 p-2 bg-surface rounded-lg inline-block border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">{feature.title}</h3>
              <p className="text-on-surface-variant text-sm leading-snug">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-surface-container border-2 border-primary rounded-xl p-4 mb-6 flex items-start sm:items-center gap-4 shadow-[4px_4px_0px_0px_#003594] transform hover:-translate-y-0.5 transition-transform">
          <div className="p-2 bg-primary text-on-primary rounded-lg border-2 border-on-surface shrink-0 transform -rotate-6">
            <Key size={24} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-on-surface mb-1">Don't forget your API Key!</h4>
            <p className="text-on-surface-variant text-sm">
              To use the AI features, you'll need to configure your LLM Provider and API Key in the <strong className="text-primary">Settings</strong> menu after continuing.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleGetStarted}
            className="group relative inline-flex items-center gap-3 bg-primary text-on-primary font-bold text-xl px-10 py-4 rounded-xl border-[3px] border-on-surface shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 active:shadow-none active:translate-y-1.5 active:translate-x-1.5 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative z-10">Get Started</span>
            <ArrowRight size={24} className="relative z-10 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
