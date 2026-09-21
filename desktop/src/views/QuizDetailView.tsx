import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  HelpCircle,
  Play,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
  RotateCcw,
  Check,
  X,
  History,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import {
  client,
  type QuizDetailResponse,
  type QuizAttemptSummaryResponse,
} from '../api/client';
import { QuizDeleteDialog } from '../components/quizzes';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ErrorState } from '../components/shared';
import { Tag } from '../components/ui/Tag';
import { useToast } from '../hooks/useToast';

export function QuizDetailView() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [quiz, setQuiz] = useState<QuizDetailResponse | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline rename
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Delete dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchQuizData = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    setError(null);
    try {
      const [quizData, attemptData] = await Promise.all([
        client.getQuiz(quizId),
        client.listQuizAttempts(quizId).catch(() => [] as QuizAttemptSummaryResponse[]),
      ]);
      setQuiz(quizData);
      setEditTitleValue(quizData.title);
      setAttempts(attemptData);
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to load quiz details.');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  const handleSaveTitle = async () => {
    if (!quiz || !editTitleValue.trim() || editTitleValue.trim() === quiz.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      const updated = await client.updateQuiz(quiz.id, { title: editTitleValue.trim() });
      setQuiz((prev) => (prev ? { ...prev, title: updated.title } : null));
      setIsEditingTitle(false);
      showToast('success', 'Quiz renamed.');
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to rename quiz.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!quiz) return;
    setIsDeleting(true);
    try {
      await client.deleteQuiz(quiz.id);
      showToast('success', `"${quiz.title}" deleted.`);
      navigate('/app/quizzes');
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to delete quiz.');
      setIsDeleting(false);
    }
  };

  const difficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy':
        return 'success';
      case 'medium':
        return 'warning';
      case 'hard':
        return 'error';
      default:
        return 'default';
    }
  };

  const formattedDate = quiz?.created_at
    ? new Date(quiz.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-8 w-32 bg-surface-container-low rounded-lg animate-pulse" />
          <div className="h-40 bg-surface-container-low rounded-2xl animate-pulse" />
          <div className="h-64 bg-surface-container-low rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <ErrorState
          title="Quiz Not Found"
          message={error || 'The requested quiz could not be loaded.'}
          onRetry={fetchQuizData}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/quizzes')}
              className="gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Quizzes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Standard Breadcrumb Navigation */}
        <Breadcrumbs
          items={[
            { label: 'Quizzes', href: '/app/quizzes' },
            { label: quiz.title },
          ]}
        />

        {/* Hero Card */}
        <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface-container shadow-neo space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo-sm shrink-0 mt-0.5">
                <HelpCircle size={24} />
              </div>
              <div className="space-y-2 min-w-0">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      className="text-lg sm:text-xl font-black bg-surface-container-low border-2 border-primary rounded-lg px-2.5 py-1 text-on-surface focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveTitle}
                      disabled={isSavingTitle}
                      className="p-2"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTitle(false)}
                      className="p-2"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-on-surface break-words">
                      {quiz.title}
                    </h1>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                      title="Rename quiz"
                      aria-label="Rename quiz"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}

                {/* Metadata tags */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Tag variant={difficultyColor(quiz.difficulty) as any} size="sm">
                    {quiz.difficulty.toUpperCase()}
                  </Tag>
                  <Tag variant="default" size="sm">
                    {quiz.questions?.length || quiz.question_count} Questions
                  </Tag>
                  {quiz.topic && (
                    <Tag variant="primary" size="sm">
                      {quiz.topic}
                    </Tag>
                  )}
                  {formattedDate && (
                    <span className="flex items-center gap-1 text-xs text-on-surface-variant/70 font-semibold ml-1">
                      <Calendar size={12} /> {formattedDate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top right actions */}
            <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-error hover:bg-error/10 hover:border-error/30 p-2"
                title="Delete quiz"
                aria-label="Delete quiz"
              >
                <Trash2 size={16} />
              </Button>
              <Button
                variant="ai"
                size="md"
                onClick={() => navigate(`/app/quizzes/${quiz.id}/attempt`)}
                className="gap-2 shadow-neo-sm"
              >
                <Play size={16} className="fill-current" />
                Start Assessment
              </Button>
            </div>
          </div>
        </div>

        {/* Attempt History Section */}
        <div className="p-6 rounded-2xl border-2 border-border-default bg-surface-container shadow-neo space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-primary" />
              <h2 className="text-base font-black text-on-surface">Past Attempts</h2>
            </div>
            <span className="text-xs text-on-surface-variant font-semibold">
              {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'} recorded
            </span>
          </div>

          {attempts.length === 0 ? (
            <div className="p-8 rounded-xl border-2 border-dashed border-border-default text-center space-y-3">
              <Clock size={28} className="mx-auto text-on-surface-variant/50" />
              <p className="text-xs font-semibold text-on-surface-variant max-w-sm mx-auto">
                You haven't attempted this quiz yet. Take the assessment to benchmark your retention and get question-by-question feedback.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/app/quizzes/${quiz.id}/attempt`)}
                className="gap-1.5"
              >
                <Play size={13} className="fill-current" /> Take First Attempt
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border-default/50 border-2 border-border-default rounded-xl overflow-hidden bg-surface-container-low">
              {attempts.map((att, idx) => {
                const isSubmitted = att.status === 'submitted';
                const scorePercent =
                  att.score !== undefined && att.score !== null && att.total_questions > 0
                    ? Math.round((att.score / att.total_questions) * 100)
                    : null;
                const attDate = new Date(att.started_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={att.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-high/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container border border-border-default flex items-center justify-center font-mono text-xs font-bold text-on-surface-variant">
                        #{attempts.length - idx}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface">
                            {attDate}
                          </span>
                          <Tag
                            variant={isSubmitted ? (scorePercent !== null && scorePercent >= 70 ? 'success' : 'warning') : 'default'}
                            size="sm"
                          >
                            {isSubmitted ? `${att.score}/${att.total_questions} (${scorePercent}%)` : 'In Progress'}
                          </Tag>
                        </div>
                        <p className="text-[11px] text-on-surface-variant/70 font-medium">
                          Status: {att.status}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant={isSubmitted ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() =>
                        isSubmitted
                          ? navigate(`/app/quizzes/${quiz.id}/results/${att.id}`)
                          : navigate(`/app/quizzes/${quiz.id}/attempt`)
                      }
                      className="gap-1 text-xs self-end sm:self-center"
                    >
                      {isSubmitted ? 'View Results' : 'Resume Attempt'}
                      <ChevronRight size={13} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Questions Outline */}
        <div className="p-6 rounded-2xl border-2 border-border-default bg-surface-container shadow-neo space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary" />
              <h2 className="text-base font-black text-on-surface">Questions Overview</h2>
            </div>
            <span className="text-xs text-on-surface-variant font-semibold">
              {quiz.questions?.length || 0} questions
            </span>
          </div>

          <div className="space-y-3">
            {quiz.questions?.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border-2 border-border-default bg-surface-container-low space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded bg-surface-container-high border border-border-default flex items-center justify-center font-mono text-xs font-bold text-on-surface shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs font-bold text-on-surface leading-snug">
                      {q.question_text || q.question}
                    </p>
                  </div>
                  <Tag variant="default" size="sm" className="shrink-0 text-[10px]">
                    {(q.question_type || q.type) === 'multiple_choice' ? 'Multiple Choice' : 'True/False'}
                  </Tag>
                </div>
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-8 pt-1">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className="text-[11px] font-medium text-on-surface-variant bg-surface-container/60 px-2 py-1 rounded border border-border-default/40 flex items-center gap-1.5"
                      >
                        <span className="font-mono text-[10px] text-on-surface-variant/70 font-bold">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <span className="truncate">{opt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <QuizDeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        quizTitle={quiz.title}
        isDeleting={isDeleting}
      />
    </div>
  );
}
export default QuizDetailView;
