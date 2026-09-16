import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  ArrowRight, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  Cpu, 
  GraduationCap, 
  FileText,
  Clock,
  Layers
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Tag';
import { ThemeToggle } from '../../hooks/useTheme';

export function OnboardingView() {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<string>('academic');
  const [isProcessingSample, setIsProcessingSample] = useState(false);

  const goals = [
    {
      id: 'academic',
      title: 'Academic & Exam Mastery',
      desc: 'Textbooks, course packets, and comprehensive exams (Medical, Law, STEM).',
      icon: <GraduationCap size={20} className="text-primary" />
    },
    {
      id: 'engineering',
      title: 'Technical Specs & Engineering',
      desc: 'System design RFCs, architecture manuals, and API documentation.',
      icon: <Cpu size={20} className="text-primary" />
    },
    {
      id: 'research',
      title: 'Scientific Research & Papers',
      desc: 'Journal articles, literature reviews, and cross-paper citations.',
      icon: <BookOpen size={20} className="text-primary" />
    },
    {
      id: 'general',
      title: 'Non-Fiction & Lifelong Reading',
      desc: 'Business, philosophy, and non-fiction books for mental model retention.',
      icon: <Layers size={20} className="text-primary" />
    }
  ];

  const handleFinish = () => {
    completeOnboarding();
    navigate('/app', { replace: true });
  };

  const handleLoadSample = async () => {
    setIsProcessingSample(true);
    // Lightweight simulation to introduce the workspace
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsProcessingSample(false);
    handleFinish();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm">
            <Brain size={18} className="stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-on-surface">Recall AI Setup</span>
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={handleFinish}
            className="text-xs font-bold text-on-surface-variant hover:text-on-surface hover:underline px-2 py-1 focus:outline-none"
          >
            Skip to Dashboard
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-2xl">
          <div className="p-6 sm:p-10 rounded-2xl border-2 border-border-default bg-surface shadow-neo-lg space-y-8">
            
            {/* Step 1: Learning Focus */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="space-y-2">
                  <Badge variant="outline" size="sm">Step 1 of 2</Badge>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                    Welcome, {user?.full_name || user?.email?.split('@')[0] || 'Scholar'}!
                  </h1>
                  <p className="text-sm text-on-surface-variant font-medium">
                    What primary kind of knowledge are you looking to master in Recall AI?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {goals.map((goal) => {
                    const isSelected = selectedGoal === goal.id;
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => setSelectedGoal(goal.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-neo-sm ring-2 ring-primary/20'
                            : 'border-border-default bg-surface-container-low/50 hover:bg-surface-container hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="p-2 rounded-lg bg-surface border border-border-default">
                            {goal.icon}
                          </div>
                          {isSelected && <CheckCircle2 size={18} className="text-primary stroke-[2.5]" />}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-on-surface">{goal.title}</h3>
                          <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{goal.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="text-xs font-bold text-on-surface-variant hover:text-on-surface"
                  >
                    Skip setup
                  </button>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setStep(2)}
                    className="font-extrabold shadow-neo"
                  >
                    <span>Next: Add Knowledge</span>
                    <ArrowRight size={16} className="ml-2 stroke-[2.5]" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: First Knowledge Action */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="space-y-2">
                  <Badge variant="outline" size="sm">Step 2 of 2</Badge>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                    Add your first piece of knowledge
                  </h1>
                  <p className="text-sm text-on-surface-variant font-medium">
                    Upload a PDF textbook or start with our pre-loaded interactive guide to see Recall AI in action.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Upload Drop Zone Preview */}
                  <div 
                    onClick={handleFinish}
                    className="p-8 rounded-2xl border-2 border-dashed border-border-default bg-surface-container-low/40 hover:bg-surface-container-high/60 transition-all cursor-pointer text-center space-y-3 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 group-hover:scale-105 transition-transform">
                      <Upload size={24} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-on-surface">
                        Click to upload your first document
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Supports PDF textbooks, research papers, and lecture notes (up to 50MB on Free tier).
                      </p>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-surface border border-border-default text-on-surface">
                      Opens document importer in Documents
                    </span>
                  </div>

                  {/* Or Sample Document Card */}
                  <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface border border-border-default flex items-center justify-center text-primary shrink-0 shadow-neo-sm">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-on-surface">
                          Don't have a PDF right now?
                        </h4>
                        <p className="text-[11px] text-on-surface-variant">
                          Explore our interactive guide on "The Architecture of Distributed Systems".
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadSample}
                      isLoading={isProcessingSample}
                      disabled={isProcessingSample}
                      className="font-bold border-2 border-border-default shadow-neo-sm shrink-0"
                    >
                      <span>Explore Sample</span>
                    </Button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-bold text-on-surface-variant hover:text-on-surface"
                  >
                    Back to goals
                  </button>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleFinish}
                    className="font-extrabold shadow-neo"
                  >
                    <span>Enter Dashboard</span>
                    <ArrowRight size={16} className="ml-2 stroke-[2.5]" />
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
