import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Target, X, Loader2, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Lightbulb, CreditCard, ArrowRight, Save, RotateCcw, PenTool } from 'lucide-react';
import { client, type AtomicConcept, type DiagnosticQuestion, type DiagnosticQuestionSet, type DiagnosticEvaluation, type SuggestedFlashcard } from '../api/client';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import clsx from 'clsx';
import { useToast } from '../hooks/useToast';
import type { ApiError } from '../api/errors';

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
  targetConcept?: AtomicConcept | null;
  onClearTargetConcept?: () => void;
  hasCachedMarkdown?: boolean;
  onMasteryUpdate?: (score: number, status: string, conceptName?: string) => void;
  onSuccess?: () => void;
}

type DrillPhase = 'idle' | 'generating' | 'answering' | 'evaluating' | 'feedback';

export function SocraticDrillWidget({ topicId, topicTitle, targetConcept, onClearTargetConcept, hasCachedMarkdown, onMasteryUpdate, onSuccess }: SocraticDrillWidgetProps) {
  const { activeProvider, pdfExtractor } = useSelector((state: RootState) => state.providers);

  const [phase, setPhase] = useState<DrillPhase>('idle');
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<DiagnosticEvaluation | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [savedCards, setSavedCards] = useState<Set<number>>(new Set());
  const [isPinningGaps, setIsPinningGaps] = useState(false);
  const [gapsPinned, setGapsPinned] = useState(false);
  const { showToast } = useToast();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when topic or targeted concept changes
  useEffect(() => {
    setPhase('idle');
    setQuestions([]);
    setCurrentQIdx(0);
    setAnswer('');
    setEvaluation(null);
    setHintOpen(false);
    setSavedCards(new Set());
    setIsPinningGaps(false);
    setGapsPinned(false);
  }, [topicId, targetConcept?.name]);

  const currentQuestion = questions[currentQIdx];
  const tierInfo = currentQuestion ? TIER_LABELS[currentQuestion.tier] : null;

  const handleStartDrill = async () => {
    setPhase('generating');
    setQuestions([]);
    setCurrentQIdx(0);
    setAnswer('');
    setEvaluation(null);
    setSavedCards(new Set());

    try {
      const result: DiagnosticQuestionSet = await client.generateDrillQuestions(
        topicId,
        activeProvider,
        targetConcept ? {
          name: targetConcept.name,
          concept_type: targetConcept.concept_type,
          summary: targetConcept.summary,
          key_terms: targetConcept.key_terms
        } : null
      );
      if (!result.questions || result.questions.length === 0) {
        throw new Error("No questions were generated. The topic might be too short.");
      }
      setQuestions(result.questions);
      setPhase('answering');
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      showToast('error', e?.userMessage || "Failed to generate questions", e?.debugDetail);
      setPhase('idle');
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !currentQuestion) return;
    setPhase('evaluating');

    try {
      const result = await client.evaluateDrillAnswer(
        topicId,
        currentQuestion.id,
        currentQuestion.question_text,
        currentQuestion.key_invariants,
        answer.trim(),
        activeProvider,
        targetConcept?.name || null,
        currentQuestion.tier,
        currentQuestion.socratic_hint
      );
      setEvaluation(result);
      setPhase('feedback');
      onMasteryUpdate?.(result.mastery_score, result.status, targetConcept?.name);
    } catch (e: any) {
      showToast('error', e?.userMessage || "Failed to evaluate answer", e?.debugDetail);
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
      setIsPinningGaps(false);
      setGapsPinned(false);
      setPhase('answering');
    }
  };

  const handlePinGapsToNotes = async () => {
    if (!evaluation) return;
    setIsPinningGaps(true);
    try {
      const parts: string[] = [];
      const timestamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      parts.push(`*Recorded from Socratic Drill on ${timestamp}*`);
      if (targetConcept?.name) {
        parts.push(`**Target Concept:** ${targetConcept.name}`);
      }
      if (evaluation.diagnosed_gaps.length > 0) {
        parts.push('**Knowledge Gaps Identified:**\n' + evaluation.diagnosed_gaps.map(g => `- ${g}`).join('\n'));
      }
      if (evaluation.misconceptions.length > 0) {
        parts.push('**Misconceptions Corrected:**\n' + evaluation.misconceptions.map(m => `- ${m}`).join('\n'));
      }
      if (evaluation.socratic_nudge) {
        parts.push(`**Key Insight / Nudge:**\n> ${evaluation.socratic_nudge}`);
      }
      
      const content = parts.join('\n\n');
      await client.appendNote(topicId, content, '⚠️ Exam Pitfalls & Misconceptions');
      setGapsPinned(true);
      showToast('success', 'Pinned gaps and pitfalls to Study Notes!');
    } catch (err: any) {
      console.error('Failed to pin gaps to notes:', err);
      showToast('error', err?.userMessage || 'Failed to pin gaps to notes.', err?.debugDetail);
    } finally {
      setIsPinningGaps(false);
    }
  };

  const handleSaveCard = async (card: SuggestedFlashcard, idx: number) => {
    try {
      await client.saveDrillFlashcards(topicId, [card]);
      setSavedCards(prev => new Set(prev).add(idx));
      showToast('success', 'Flashcard saved to SRS deck.');
    } catch (e: any) {
      showToast('error', e?.userMessage || "Failed to save flashcard", e?.debugDetail);
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
      <div className={clsx(
        "w-full border-2 rounded-xl shadow-[2px_2px_0px_0px_#191b23] p-4 flex flex-col gap-3 relative overflow-hidden group hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#191b23] transition-all duration-300",
        targetConcept ? "border-secondary/50 bg-secondary/5" : "border-outline-variant bg-surface-container-lowest"
      )}>
        <div className={clsx(
          "absolute -right-12 -top-12 w-48 h-48 rounded-full blur-2xl transition-colors pointer-events-none",
          targetConcept ? "bg-secondary/10 group-hover:bg-secondary/20" : "bg-primary/5 group-hover:bg-primary/10"
        )}></div>
        <div className="flex items-start justify-between z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]",
                targetConcept ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary"
              )}>
                {targetConcept ? <Target size={14} /> : <BrainCircuit size={14} />}
              </div>
              <h1 className="text-lg font-bold text-on-surface m-0 leading-none">
                {targetConcept ? (
                  <>Concept Drill: <span className="text-secondary">{targetConcept.name}</span></>
                ) : (
                  "Socratic Diagnostic Drill"
                )}
              </h1>
              {targetConcept && (
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/30">
                  {targetConcept.concept_type}
                </span>
              )}
            </div>

            {targetConcept ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-on-surface-variant max-w-2xl mt-1">
                  Targeted causal & counterfactual drill probing <span className="font-bold text-on-surface bg-surface-variant px-1 rounded">{targetConcept.name}</span> in {topicTitle}.
                </p>
                {targetConcept.summary && (
                  <p className="text-xs text-on-surface-variant/80 italic line-clamp-2 max-w-2xl">
                    "{targetConcept.summary}"
                  </p>
                )}
                {onClearTargetConcept && (
                  <button
                    onClick={onClearTargetConcept}
                    className="text-xs font-bold text-primary hover:underline self-start flex items-center gap-1 mt-1 transition-colors"
                  >
                    <X size={12} /> Clear concept focus (drill entire topic)
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-on-surface-variant max-w-2xl mt-1">
                  The AI will generate targeted questions about <span className="font-bold text-on-surface bg-surface-variant px-1 rounded">{topicTitle}</span> to probe your causal understanding, test edge cases, and diagnose gaps.
                </p>
                <p className="text-xs text-on-surface-variant/75 mt-1.5 flex items-center gap-1.5">
                  <span className="font-semibold text-primary">Pro-tip:</span> To drill an individual formula, theorem, or definition, click <span className="font-semibold text-on-surface bg-surface-variant/70 px-1 py-0.5 rounded text-[11px]">Drill Concept</span> in the Atomic Concepts deck below.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 z-10">
          <button
            onClick={handleStartDrill}
            className={clsx(
              "font-bold text-sm px-6 py-2.5 rounded-lg border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] flex items-center gap-2 active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all whitespace-nowrap",
              targetConcept ? "bg-secondary text-on-secondary hover:brightness-110" : "bg-primary text-on-primary hover:bg-academic-blue"
            )}
          >
            {targetConcept ? <Target size={16} /> : <BrainCircuit size={16} />}
            {targetConcept ? `Drill "${targetConcept.name}"` : 'Start Socratic Drill'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Generating State ───────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow-lg p-8 flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider text-center">
          {targetConcept 
            ? `Analyzing and generating diagnostic questions for "${targetConcept.name}"…`
            : "Analyzing topic and generating diagnostic questions…"}
        </p>
        
        {hasCachedMarkdown ? (
          <p className="font-body-sm text-body-sm text-emerald-600 font-bold italic mt-2 text-center max-w-sm flex items-center justify-center gap-1">
            <CheckCircle2 size={14} /> Using cached markdown to generate
          </p>
        ) : (
          pdfExtractor === 'marker' && (
            <p className="font-body-sm text-body-sm text-amber-600 font-medium italic mt-2 text-center max-w-sm">
              Marker (ML) is currently extracting text for this section. This may take a few minutes if models are downloading.
            </p>
          )
        )}
      </div>
    );
  }

  // ─── Answering State ────────────────────────────────────────────────
  if (phase === 'answering' && currentQuestion) {
    return (
      <div className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b-[3px] border-on-background flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3 flex-wrap">
            <BrainCircuit size={20} className="text-primary" />
            <span className="font-headline-sm text-headline-sm font-bold text-primary">Socratic Drill</span>
            {targetConcept && (
              <span className="text-label-sm font-label-sm font-bold uppercase tracking-wider bg-secondary/10 text-secondary px-2.5 py-1 border-[2px] border-secondary/40 neo-shadow-xs">
                Target: {targetConcept.name}
              </span>
            )}
            <span className="text-label-sm font-label-sm font-bold text-on-surface-variant uppercase tracking-wider bg-surface px-2 py-1 border-[3px] border-primary">
              Q{currentQIdx + 1} of {questions.length}
            </span>
          </div>
          {tierInfo && (
            <span className={clsx("text-label-sm font-label-sm font-bold uppercase tracking-wider px-3 py-1 border-[3px] border-primary neo-shadow-sm", tierInfo.bg, tierInfo.color)}>
              {tierInfo.label}
            </span>
          )}
        </div>

        <div className="p-6">
          {/* Question */}
          <p className="font-body-lg text-body-lg text-primary font-medium leading-relaxed mb-6">
            {currentQuestion.question_text}
          </p>

          {/* Socratic Hint Accordion */}
          <button
            onClick={() => setHintOpen(!hintOpen)}
            className="flex items-center gap-2 text-label-sm font-label-sm font-bold text-amber-500 hover:text-amber-600 mb-6 transition-colors uppercase tracking-wider"
          >
            <Lightbulb size={16} />
            {hintOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {hintOpen ? 'Hide Hint' : 'Request Socratic Hint'}
          </button>
          {hintOpen && (
            <div className="mb-6 p-4 bg-amber-500/10 border-[3px] border-amber-500 text-body-md font-body-md text-amber-700 leading-relaxed italic neo-shadow-sm">
              💡 {currentQuestion.socratic_hint}
            </div>
          )}

          {/* Answer Textarea */}
          <div className="mb-6">
            <label className="text-label-sm font-label-sm font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
              Your Explanation
            </label>
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Explain your understanding... (bullet points or paragraph)"
              className="w-full bg-surface border-[3px] border-on-background p-4 text-label-md font-label-md text-primary placeholder:text-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all resize-none min-h-[140px]"
              rows={5}
            />
            <p className="text-label-sm font-label-sm text-on-surface-variant mt-2 font-bold uppercase">Press Ctrl+Enter to submit</p>
          </div>

          <button
            onClick={handleSubmitAnswer}
            disabled={!answer.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold border-[3px] border-primary neo-shadow-sm active-neo-press transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight size={18} />
            Submit & Diagnose
          </button>
        </div>
      </div>
    );
  }

  // ─── Evaluating State ───────────────────────────────────────────────
  if (phase === 'evaluating') {
    return (
      <div className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow-lg p-8 flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
          {targetConcept
            ? `Evaluating your answer against "${targetConcept.name}"…`
            : "Analyzing your answer against the source material…"}
        </p>
      </div>
    );
  }

  // ─── Feedback State ─────────────────────────────────────────────────
  if (phase === 'feedback' && evaluation && currentQuestion) {
    const statusInfo = STATUS_CONFIG[evaluation.status];
    const StatusIcon = statusInfo?.icon || AlertTriangle;
    const hasNextQ = currentQIdx < questions.length - 1;

    return (
      <div className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b-[3px] border-on-background flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <BrainCircuit size={20} className="text-primary" />
            <span className="font-headline-sm text-headline-sm font-bold text-primary">
              {targetConcept ? `Diagnostic: ${targetConcept.name}` : "Diagnostic Results"}
            </span>
          </div>
          <div className={clsx("flex items-center gap-2 font-label-md text-label-md font-bold px-3 py-1 border-[3px] border-primary neo-shadow-sm", statusInfo?.bg, statusInfo?.color)}>
            <StatusIcon size={16} />
            {evaluation.mastery_score}/100 — {statusInfo?.label}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Mastery Bar */}
          <div>
            <div className="flex items-center justify-between font-label-md text-label-md font-bold text-on-surface-variant mb-2 uppercase tracking-wider">
              <span>Mastery Level</span>
              <span className="font-mono">{evaluation.mastery_score}%</span>
            </div>
            <div className="w-full h-4 bg-surface-container border-[3px] border-on-background overflow-hidden">
              <div
                className={clsx(
                  "h-full transition-all duration-700",
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
              <h4 className="font-label-md text-label-md font-bold text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} /> What You Mastered
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
              <h4 className="font-label-md text-label-md font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle size={16} /> Gaps Identified
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
              <h4 className="font-label-md text-label-md font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <XCircle size={16} /> Misconceptions Detected
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

          {/* Pin Gaps to Study Notes Button */}
          {(evaluation.diagnosed_gaps.length > 0 || evaluation.misconceptions.length > 0) && (
            <div className="pt-1">
              <button
                onClick={handlePinGapsToNotes}
                disabled={isPinningGaps || gapsPinned}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 font-bold text-xs border-[3px] border-primary transition-all cursor-pointer",
                  gapsPinned
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500 cursor-default"
                    : "bg-amber-500 text-black hover:bg-amber-400 neo-shadow-sm active-neo-press"
                )}
              >
                {gapsPinned ? (
                  <>
                    <CheckCircle2 size={15} /> Pinned Gaps to Study Notes
                  </>
                ) : isPinningGaps ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Pinning to Notes...
                  </>
                ) : (
                  <>
                    <PenTool size={15} /> Pin Gaps & Misconceptions to Study Notes
                  </>
                )}
              </button>
            </div>
          )}

          {/* Socratic Nudge */}
          {evaluation.socratic_nudge && (
            <div className="p-4 bg-primary-container text-on-primary-container border-[3px] border-primary neo-shadow-sm">
              <p className="font-label-md text-label-md font-bold mb-2 flex items-center gap-2 uppercase tracking-wider">
                <Lightbulb size={16} /> Think Deeper
              </p>
              <p className="font-body-md text-body-md leading-relaxed italic">{evaluation.socratic_nudge}</p>
            </div>
          )}

          {/* Targeted Flashcards */}
          {evaluation.suggested_flashcards.length > 0 && (
            <div>
              <h4 className="font-label-md text-label-md font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <CreditCard size={16} /> Targeted Flashcards ({evaluation.suggested_flashcards.length})
              </h4>
              <div className="space-y-4">
                {evaluation.suggested_flashcards.map((card, i) => (
                  <div key={i} className="p-4 bg-surface border-[3px] border-on-background neo-shadow-sm">
                    <p className="text-label-sm font-label-sm font-bold uppercase tracking-wider text-on-surface-variant mb-2">Gap: {card.gap_source}</p>
                    <p className="font-body-md text-body-md text-primary font-bold mb-2">Q: {card.question}</p>
                    <p className="font-body-md text-body-md text-on-surface mb-4">A: {card.answer}</p>
                    <button
                      onClick={() => handleSaveCard(card, i)}
                      disabled={savedCards.has(i)}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-2 text-label-md font-bold transition-colors",
                        savedCards.has(i)
                          ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                          : "bg-surface-container border-[3px] border-primary text-primary hover:bg-surface-container-high neo-shadow-sm active-neo-press"
                      )}
                    >
                      {savedCards.has(i) ? <><CheckCircle2 size={16} /> Saved to Deck</> : <><Save size={16} /> Add to SRS Deck</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            {hasNextQ && (
              <button
                onClick={handleNextQuestion}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-white font-bold border-[3px] border-primary neo-shadow-sm active-neo-press transition-all"
              >
                <ArrowRight size={18} />
                Next Question
              </button>
            )}
            <button
              onClick={() => { setPhase('idle'); setQuestions([]); setEvaluation(null); setAnswer(''); }}
              className="flex items-center gap-2 px-6 py-3 bg-surface-container text-on-surface font-bold border-[3px] border-primary neo-shadow-sm active-neo-press transition-all"
            >
              <RotateCcw size={16} />
              {hasNextQ ? 'Restart Drill' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
