import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Send,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import {
  client,
  type QuizAttemptStartResponse,
  type MaskedQuizQuestion,
  type SubmitAnswerItem,
} from '../api/client';
import {
  QuestionRenderer,
  QuestionNavigator,
  SubmitConfirmDialog,
} from '../components/quizzes';
import { Button } from '../components/ui/Button';
import { Dialog, DialogFooter } from '../components/ui/Dialog';
import { useToast } from '../hooks/useToast';

export function QuizAttemptView() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [attempt, setAttempt] = useState<QuizAttemptStartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active question index
  const [currentIndex, setCurrentIndex] = useState(0);

  // User answers map: question_id -> selected_answer
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Start attempt on mount
  const initAttempt = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.startQuizAttempt(quizId);
      setAttempt(data);
      if (data.questions.length === 0) {
        setError('This quiz contains no questions yet.');
      }
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to start assessment.');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    initAttempt();
  }, [initAttempt]);

  // Timer interval
  useEffect(() => {
    if (!attempt || loading || error) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, loading, error]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Autosave answer to server
  const handleSelectAnswer = (questionId: string, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));

    if (!attempt) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await client.recordQuizAnswer(attempt.id, {
          question_id: questionId,
          selected_answer: answer,
        });
      } catch (err) {
        console.warn('Interim autosave failed (will submit on finalization):', err);
      } finally {
        setIsSaving(false);
      }
    }, 300);
  };

  // Handle final submission
  const handleSubmitConfirm = async () => {
    if (!attempt) return;
    setIsSubmitting(true);
    try {
      const answersPayload: SubmitAnswerItem[] = Object.entries(userAnswers).map(
        ([question_id, selected_answer]) => ({
          question_id,
          selected_answer,
        })
      );

      const result = await client.submitQuizAttempt(attempt.id, answersPayload);
      showToast('success', 'Assessment submitted successfully!');
      navigate(`/app/quizzes/${quizId}/results/${result.id}`);
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to submit assessment.');
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation for Prev/Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSubmitModal || showExitModal) return;
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex((i) => i - 1);
      } else if (
        e.key === 'ArrowRight' &&
        attempt &&
        currentIndex < attempt.questions.length - 1
      ) {
        e.preventDefault();
        setCurrentIndex((i) => i + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, attempt, showSubmitModal, showExitModal]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <p className="text-sm font-bold text-on-surface">Initializing assessment...</p>
      </div>
    );
  }

  if (error || !attempt || attempt.questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-error/10 text-error border-2 border-error/20 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-black text-on-surface">Assessment Error</h2>
          <p className="text-sm text-on-surface-variant max-w-sm">{error || 'Unable to load questions.'}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate(`/app/quizzes/${quizId}`)} className="gap-1.5">
          <ArrowLeft size={14} /> Back to Quiz
        </Button>
      </div>
    );
  }

  const currentQuestion: MaskedQuizQuestion = attempt.questions[currentIndex];
  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = attempt.questions.length;
  const progressPercent = Math.round((answeredCount / totalCount) * 100);

  // Map answered indices for navigator
  const answeredIndices = new Set<number>();
  attempt.questions.forEach((q, idx) => {
    if (userAnswers[q.id] !== undefined && userAnswers[q.id] !== '') {
      answeredIndices.add(idx);
    }
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden">
      {/* Top Assessment Header */}
      <header className="h-16 px-4 sm:px-6 border-b-2 border-border-default bg-surface-container flex items-center justify-between gap-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExitModal(true)}
            className="p-2 text-on-surface-variant hover:text-on-surface"
            title="Exit Assessment"
            aria-label="Exit Assessment"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Q{currentIndex + 1}/{totalCount}
              </span>
              <span className="text-xs font-bold text-on-surface truncate hidden sm:inline-block max-w-[200px] md:max-w-xs">
                Assessment in Progress
              </span>
            </div>
          </div>
        </div>

        {/* Center: Timer & Autosave */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-on-surface px-2.5 py-1 rounded-lg bg-surface-container-low border border-border-default">
            <Clock size={14} className="text-primary" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>
          {isSaving && (
            <span className="text-[11px] font-semibold text-on-surface-variant/70 animate-pulse hidden sm:inline">
              Saving...
            </span>
          )}
        </div>

        {/* Right: Submit Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="gap-1.5 text-xs font-bold shadow-neo-sm"
          >
            <Send size={13} />
            <span className="hidden sm:inline">Review &</span> Submit
          </Button>
        </div>
      </header>

      {/* Progress Bar Strip */}
      <div className="w-full h-1.5 bg-surface-container-low border-b border-border-default/40 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Assessment Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Question Navigator */}
          <QuestionNavigator
            questions={attempt.questions}
            currentIndex={currentIndex}
            answers={userAnswers}
            onSelectQuestion={(idx: number) => setCurrentIndex(idx)}
          />

          {/* Question Card */}
          <QuestionRenderer
            question={currentQuestion}
            selectedAnswer={userAnswers[currentQuestion.id] || undefined}
            onSelectAnswer={(val) => handleSelectAnswer(currentQuestion.id, val)}
          />

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="gap-1.5 text-xs font-bold"
            >
              <ChevronLeft size={16} />
              Previous
            </Button>

            {currentIndex < totalCount - 1 ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentIndex((i) => Math.min(totalCount - 1, i + 1))}
                className="gap-1.5 text-xs font-bold"
              >
                Next
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                variant="ai"
                size="md"
                onClick={() => setShowSubmitModal(true)}
                className="gap-1.5 text-xs font-bold shadow-neo-sm"
              >
                <CheckCircle2 size={16} />
                Finish Assessment
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <SubmitConfirmDialog
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitConfirm}
        totalQuestions={totalCount}
        answeredCount={answeredCount}
        isSubmitting={isSubmitting}
      />

      {/* Exit Modal */}
      <Dialog
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="Leave Assessment?"
      >
        <div className="space-y-3">
          <p className="text-xs text-on-surface-variant font-medium">
            Your recorded answers are saved, but the assessment is still in progress. You can resume this attempt anytime from the Quiz details page.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setShowExitModal(false)}>
            Continue Quiz
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/app/quizzes/${quizId}`)}
            className="text-error hover:bg-error/10"
          >
            Leave Assessment
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
export default QuizAttemptView;
