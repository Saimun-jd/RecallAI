import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Loader2, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Lightbulb, CreditCard, ArrowRight, Save, RotateCcw } from 'lucide-react';
import { client, type DiagnosticQuestion, type DiagnosticQuestionSet, type DiagnosticEvaluation, type SuggestedFlashcard } from '../api/client';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import clsx from 'clsx';

const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  causal_mechanism: { label: 'Causal Mechanism', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  counterfactual: { label: 'Counterfactual', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  applied_scenario: { label: 'Applied Scenario', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  mastered: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Mastered' },
  developing: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Developing' },
  fragile: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Fragile' },
  misconception: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Misconception Detected' },
};

interface SocraticDrillWidgetProps {
  topicId: number;
  topicTitle: string;
  onMasteryUpdate?: (score: number, status: string) => void;
}

type DrillPhase = 'idle' | 'generating' | 'answering' | 'evaluating' | 'feedback';

export function SocraticDrillWidget({ topicId, topicTitle, onMasteryUpdate }: SocraticDrillWidgetProps) {
  const { activeProvider } = useSelector((state: RootState) => state.providers);

  const [phase, setPhase] = useState<DrillPhase>('idle');
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<DiagnosticEvaluation | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<Set<number>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentQuestion = questions[currentQIdx];
  const tierInfo = currentQuestion ? TIER_LABELS[currentQuestion.tier] : null;

  const handleStartDrill = async () => {
    setPhase('generating');
    setError(null);
    setQuestions([]);
    setCurrentQIdx(0);
    setAnswer('');
    setEvaluation(null);
    setSavedCards(new Set());

    try {
      const result: DiagnosticQuestionSet = await client.generateDrillQuestions(topicId, activeProvider);
      if (!result.questions || result.questions.length === 0) {
        throw new Error("No questions were generated. The topic might be too short.");
      }
      setQuestions(result.questions);
      setPhase('answering');
    } catch (e: any) {
      setError(e.message || "Failed to generate questions");
      setPhase('idle');
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !currentQuestion) return;
    setPhase('evaluating');
    setError(null);

    try {
      const result = await client.evaluateDrillAnswer(
        topicId,
        currentQuestion.id,
        currentQuestion.question_text,
        currentQuestion.key_invariants,
        answer.trim(),
        activeProvider,
      );
      setEvaluation(result);
      setPhase('feedback');
      onMasteryUpdate?.(result.mastery_score, result.status);
    } catch (e: any) {
      setError(e.message || "Failed to evaluate answer");
      setPhase('answering');
    }
  };

  const handleNextQuestion = () => {
    if (currentQIdx < questions.length - 1) {
      setCurrentQIdx(prev => prev + 1);
      setAnswer('');
      setEvaluation(null);
      setHintOpen(false);
      setSavedCards(new Set());
      setPhase('answering');
    }
  };

  const handleSaveCard = async (card: SuggestedFlashcard, idx: number) => {
    try {
      await client.saveDrillFlashcards(topicId, [card]);
      setSavedCards(prev => new Set(prev).add(idx));
    } catch (e: any) {
      setError(e.message || "Failed to save flashcard");
    }
  };

  // Auto-focus textarea when entering answering phase
  useEffect(() => {
    if (phase === 'answering' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase, currentQIdx]);

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && answer.trim()) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  // ─── Idle State ─────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="rounded-xl border border-accent-blue/20 bg-surface-container-lowest p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-active-bg flex items-center justify-center text-accent-blue">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">Socratic Diagnostic Drill</h3>
            <p className="text-xs text-on-surface-variant">Test your understanding with probing questions</p>
          </div>
        </div>
        <p className="text-sm text-on-surface mb-4 leading-relaxed">
          The AI will generate targeted questions about <strong className="text-primary">{topicTitle}</strong> to probe your causal understanding, test edge cases, and diagnose gaps. Only flashcards for concepts you miss will be suggested.
        </p>
        {error && (
          <p className="text-xs text-red-400 mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">{error}</p>
        )}
        <button
          onClick={handleStartDrill}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-blue text-zinc-950 rounded-lg font-semibold hover:bg-accent-blue/90 transition-colors text-sm"
        >
          <BrainCircuit size={16} />
          Start Diagnostic Drill
        </button>
      </div>
    );
  }

  // ─── Generating State ───────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="rounded-xl border border-accent-blue/20 bg-surface-container-lowest p-6 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-accent-blue" />
        <p className="text-sm text-on-surface-variant">Analyzing topic and generating diagnostic questions…</p>
      </div>
    );
  }

  // ─── Answering State ────────────────────────────────────────────────
  if (phase === 'answering' && currentQuestion) {
    return (
      <div className="rounded-xl border border-accent-blue/20 bg-surface-container-lowest overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <BrainCircuit size={16} className="text-accent-blue" />
            <span className="text-sm font-semibold text-primary">Socratic Drill</span>
            <span className="text-xs text-on-surface-variant">
              Q{currentQIdx + 1} of {questions.length}
            </span>
          </div>
          {tierInfo && (
            <span className={clsx("text-[11px] font-semibold px-2.5 py-1 rounded-full", tierInfo.bg, tierInfo.color)}>
              {tierInfo.label}
            </span>
          )}
        </div>

        <div className="p-5">
          {/* Question */}
          <p className="text-sm text-primary leading-relaxed mb-4 font-medium">
            {currentQuestion.question_text}
          </p>

          {/* Socratic Hint Accordion */}
          <button
            onClick={() => setHintOpen(!hintOpen)}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mb-4 transition-colors"
          >
            <Lightbulb size={14} />
            {hintOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {hintOpen ? 'Hide Hint' : 'Request Socratic Hint'}
          </button>
          {hintOpen && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed italic">
              💡 {currentQuestion.socratic_hint}
            </div>
          )}

          {/* Answer Textarea */}
          <div className="mb-4">
            <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-1.5 block">
              Your Explanation
            </label>
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Explain your understanding... (bullet points or paragraph)"
              className="w-full bg-surface border border-outline-variant rounded-lg p-3 text-sm text-primary placeholder:text-on-surface-variant/50 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all resize-none min-h-[120px]"
              rows={5}
            />
            <p className="text-[10px] text-on-surface-variant mt-1">Press Ctrl+Enter to submit</p>
          </div>

          {error && (
            <p className="text-xs text-red-400 mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">{error}</p>
          )}

          <button
            onClick={handleSubmitAnswer}
            disabled={!answer.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-zinc-950 rounded-lg font-semibold hover:bg-accent-blue/90 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight size={16} />
            Submit & Diagnose
          </button>
        </div>
      </div>
    );
  }

  // ─── Evaluating State ───────────────────────────────────────────────
  if (phase === 'evaluating') {
    return (
      <div className="rounded-xl border border-accent-blue/20 bg-surface-container-lowest p-6 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-accent-blue" />
        <p className="text-sm text-on-surface-variant">Analyzing your answer against the source material…</p>
      </div>
    );
  }

  // ─── Feedback State ─────────────────────────────────────────────────
  if (phase === 'feedback' && evaluation && currentQuestion) {
    const statusInfo = STATUS_CONFIG[evaluation.status];
    const StatusIcon = statusInfo?.icon || AlertTriangle;
    const hasNextQ = currentQIdx < questions.length - 1;

    return (
      <div className="rounded-xl border border-accent-blue/20 bg-surface-container-lowest overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <BrainCircuit size={16} className="text-accent-blue" />
            <span className="text-sm font-semibold text-primary">Diagnostic Results</span>
          </div>
          <div className={clsx("flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full", statusInfo?.bg, statusInfo?.color)}>
            <StatusIcon size={14} />
            {evaluation.mastery_score}/100 — {statusInfo?.label}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Mastery Bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1.5">
              <span>Mastery Level</span>
              <span className="font-mono">{evaluation.mastery_score}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-700",
                  evaluation.mastery_score >= 85 ? "bg-emerald-500" :
                  evaluation.mastery_score >= 60 ? "bg-amber-500" :
                  evaluation.mastery_score >= 35 ? "bg-orange-500" : "bg-red-500"
                )}
                style={{ width: `${evaluation.mastery_score}%` }}
              />
            </div>
          </div>

          {/* Strengths */}
          {evaluation.strengths.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> What You Mastered
              </h4>
              <ul className="space-y-1">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-on-surface flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {evaluation.diagnosed_gaps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Gaps Identified
              </h4>
              <ul className="space-y-1">
                {evaluation.diagnosed_gaps.map((g, i) => (
                  <li key={i} className="text-sm text-on-surface flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Misconceptions */}
          {evaluation.misconceptions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <XCircle size={13} /> Misconceptions Detected
              </h4>
              <ul className="space-y-1">
                {evaluation.misconceptions.map((m, i) => (
                  <li key={i} className="text-sm text-red-300/90 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Socratic Nudge */}
          {evaluation.socratic_nudge && (
            <div className="p-3 rounded-lg bg-accent-blue/5 border border-accent-blue/20">
              <p className="text-xs font-semibold text-accent-blue mb-1 flex items-center gap-1.5">
                <Lightbulb size={13} /> Think Deeper
              </p>
              <p className="text-sm text-on-surface leading-relaxed italic">{evaluation.socratic_nudge}</p>
            </div>
          )}

          {/* Targeted Flashcards */}
          {evaluation.suggested_flashcards.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-accent-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CreditCard size={13} /> Targeted Flashcards ({evaluation.suggested_flashcards.length})
              </h4>
              <div className="space-y-2">
                {evaluation.suggested_flashcards.map((card, i) => (
                  <div key={i} className="p-3 rounded-lg bg-surface border border-outline-variant">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold mb-0.5">Gap: {card.gap_source}</p>
                    <p className="text-sm text-primary font-medium mb-1">Q: {card.question}</p>
                    <p className="text-sm text-on-surface mb-2">A: {card.answer}</p>
                    <button
                      onClick={() => handleSaveCard(card, i)}
                      disabled={savedCards.has(i)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors",
                        savedCards.has(i)
                          ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                          : "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
                      )}
                    >
                      {savedCards.has(i) ? <><CheckCircle2 size={12} /> Saved to Deck</> : <><Save size={12} /> Add to SRS Deck</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg border border-red-500/20">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {hasNextQ && (
              <button
                onClick={handleNextQuestion}
                className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-zinc-950 rounded-lg font-semibold hover:bg-accent-blue/90 transition-colors text-sm"
              >
                <ArrowRight size={16} />
                Next Question
              </button>
            )}
            <button
              onClick={() => { setPhase('idle'); setQuestions([]); setEvaluation(null); setAnswer(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface rounded-lg font-medium hover:bg-surface-container-high transition-colors text-sm border border-outline-variant"
            >
              <RotateCcw size={14} />
              {hasNextQ ? 'Restart Drill' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
