import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  BookOpen,
  Filter,
  BrainCircuit,
  HelpCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  client,
  type QuizAttemptResultResponse,
  type QuestionEvaluationResult,
} from '../api/client';
import { QuestionReviewCard } from '../components/quizzes';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { LoadingState, ErrorState } from '../components/shared';
import { Tag } from '../components/ui/Tag';

export function QuizResultsView() {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<QuizAttemptResultResponse | null>(null);
  const [quizTitle, setQuizTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Filter: 'all' | 'incorrect' | 'correct'
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');

  const fetchResults = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, quizData] = await Promise.all([
        client.getQuizAttempt(attemptId) as Promise<QuizAttemptResultResponse>,
        quizId ? client.getQuiz(quizId).catch(() => null) : Promise.resolve(null),
      ]);
      if (data.status !== 'submitted') {
        // Attempt is still in progress, redirect to attempt view
        navigate(`/app/quizzes/${quizId}/attempt`, { replace: true });
        return;
      }
      setResult(data);
      if (quizData?.title) {
        setQuizTitle(quizData.title);
      }
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to load assessment results.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, quizId, navigate]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <LoadingState
          variant="page"
          message="Compiling assessment results..."
          description="Evaluating response accuracy and benchmark metrics..."
        />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <ErrorState
          title="Unable to load results"
          message={error || 'Results not found.'}
          onRetry={fetchResults}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/quizzes/${quizId}`)}
              className="gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Quiz
            </Button>
          }
        />
      </div>
    );
  }

  const scorePercent =
    result.total_questions > 0
      ? Math.round((result.score / result.total_questions) * 100)
      : 0;

  const correctCount = result.score;
  const incorrectCount = result.total_questions - result.score;

  // Calculate duration
  const startMs = new Date(result.started_at).getTime();
  const completedTime = result.submitted_at || result.completed_at;
  const endMs = completedTime ? new Date(completedTime).getTime() : Date.now();
  const durationSecs = result.duration_seconds !== undefined && result.duration_seconds !== null
    ? result.duration_seconds
    : Math.max(0, Math.round((endMs - startMs) / 1000));
  const durMins = Math.floor(durationSecs / 60);
  const durSecs = durationSecs % 60;
  const durationText = `${durMins}m ${durSecs}s`;

  // Feedback level
  let feedbackTitle = 'Needs Focus';
  let feedbackDesc = 'Review the source citations and explanations below to strengthen key concepts.';
  let feedbackBadgeVariant: 'success' | 'warning' | 'error' = 'error';

  if (scorePercent >= 80) {
    feedbackTitle = 'Outstanding Recall!';
    feedbackDesc = 'You have mastered this material with exceptional retention accuracy.';
    feedbackBadgeVariant = 'success';
  } else if (scorePercent >= 60) {
    feedbackTitle = 'Solid Foundation';
    feedbackDesc = 'Good understanding of the core concepts, with a few areas to reinforce.';
    feedbackBadgeVariant = 'warning';
  }

  const evaluations: QuestionEvaluationResult[] = result.question_results || result.evaluation || [];

  const filteredEvaluations = evaluations.filter((item: QuestionEvaluationResult) => {
    if (filter === 'correct') return item.is_correct;
    if (filter === 'incorrect') return !item.is_correct;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">
        {/* Standard Breadcrumb Navigation */}
        <Breadcrumbs
          items={[
            { label: 'Quizzes', href: '/app/quizzes' },
            { label: quizTitle || 'Quiz Details', href: `/app/quizzes/${quizId}` },
            { label: 'Results' },
          ]}
        />

        {/* Score Hero Summary Card */}
        <div className="p-4 sm:p-8 rounded-2xl border-2 border-border-default bg-surface-container shadow-neo space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Circular Score Badge */}
              <div
                className={`w-18 h-18 sm:w-24 sm:h-24 rounded-2xl border-2 flex flex-col items-center justify-center shadow-neo shrink-0 ${
                  scorePercent >= 80
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                    : scorePercent >= 60
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-500'
                }`}
              >
                <span className="text-xl sm:text-3xl font-black">{scorePercent}%</span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Score</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Tag variant={feedbackBadgeVariant} size="sm">
                    {feedbackTitle}
                  </Tag>
                </div>
                <h1 className="text-base sm:text-xl font-black text-on-surface">
                  {correctCount} of {result.total_questions} Correct
                </h1>
                <p className="text-xs text-on-surface-variant font-medium max-w-md">
                  {feedbackDesc}
                </p>
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              <Button
                variant="ai"
                size="sm"
                onClick={() => navigate(`/app/quizzes/${quizId}/attempt`)}
                className="gap-1.5 text-xs font-bold w-full sm:w-auto min-h-[40px] justify-center"
              >
                <RotateCcw size={14} /> Retake Quiz
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/app/flashcards')}
                className="gap-1.5 text-xs font-bold w-full sm:w-auto min-h-[40px] justify-center"
              >
                <BrainCircuit size={14} /> Study Flashcards
              </Button>
            </div>
          </div>

          {/* Stats Breakdown Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-4 border-t-2 border-border-default/60">
            <div className="p-3 rounded-xl bg-surface-container-low border border-border-default flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Correct</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{correctCount}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-border-default flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <XCircle size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Incorrect</p>
                <p className="text-sm font-black text-rose-600 dark:text-rose-400">{incorrectCount}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-border-default flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Duration</p>
                <p className="text-sm font-black text-on-surface">{durationText}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Review Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary shrink-0" />
              <h2 className="text-base font-black text-on-surface">Question-by-Question Review</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container border-2 border-border-default w-full sm:w-auto overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-bold rounded-lg transition-colors flex-1 sm:flex-initial text-center ${
                  filter === 'all'
                    ? 'bg-primary text-on-primary shadow-neo-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({evaluations.length})
              </button>
              <button
                onClick={() => setFilter('incorrect')}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-bold rounded-lg transition-colors flex-1 sm:flex-initial text-center ${
                  filter === 'incorrect'
                    ? 'bg-rose-500 text-white shadow-neo-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Incorrect ({incorrectCount})
              </button>
              <button
                onClick={() => setFilter('correct')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  filter === 'correct'
                    ? 'bg-emerald-500 text-white shadow-neo-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Correct ({correctCount})
              </button>
            </div>
          </div>

          {/* Evaluations List */}
          {filteredEvaluations.length === 0 ? (
            <div className="p-8 rounded-2xl border-2 border-dashed border-border-default text-center text-on-surface-variant">
              <p className="text-xs font-bold">No questions match the current filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvaluations.map((item: QuestionEvaluationResult, idx: number) => {
                const originalIndex = evaluations.findIndex((e: QuestionEvaluationResult) => e.question_id === item.question_id);
                return (
                  <QuestionReviewCard
                    key={item.question_id || idx}
                    result={item}
                    index={originalIndex !== -1 ? originalIndex : idx}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default QuizResultsView;
