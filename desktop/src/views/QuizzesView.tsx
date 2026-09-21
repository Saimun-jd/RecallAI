import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HelpCircle, Sparkles, Search } from 'lucide-react';
import {
  client,
  type QuizResponse,
  type QuizDetailResponse,
} from '../api/client';
import {
  QuizCard,
  QuizGenerateDialog,
  QuizDeleteDialog,
} from '../components/quizzes';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState, ErrorState } from '../components/shared';
import { useToast } from '../hooks/useToast';

export function QuizzesView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [quizzes, setQuizzes] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const preselectedDocId = searchParams.get('document_id') || null;

  const [deleteTarget, setDeleteTarget] = useState<QuizResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await client.listQuizzes(50, 0);
      setQuizzes(resp.quizzes);
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Auto-open generate dialog if query param is present
  useEffect(() => {
    if (searchParams.get('generate') === 'true') {
      setIsGenerateOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('generate');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleGenerateSuccess = (newQuiz: QuizDetailResponse) => {
    setQuizzes((prev) => [newQuiz, ...prev]);
    showToast('success', `Quiz "${newQuiz.title}" generated.`);
    setTimeout(() => navigate(`/app/quizzes/${newQuiz.id}`), 250);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await client.deleteQuiz(deleteTarget.id);
      setQuizzes((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      showToast('success', `"${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to delete quiz.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async (id: string) => {
    const quiz = quizzes.find((q) => q.id === id);
    if (!quiz) return;
    const newTitle = window.prompt('Rename quiz:', quiz.title);
    if (!newTitle || newTitle.trim() === quiz.title) return;
    try {
      const updated = await client.updateQuiz(id, { title: newTitle.trim() });
      setQuizzes((prev) => prev.map((q) => (q.id === id ? { ...q, title: updated.title } : q)));
      showToast('success', 'Quiz renamed.');
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to rename quiz.');
    }
  };

  const filteredQuizzes = quizzes.filter((q) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.title.toLowerCase().includes(query) ||
      (q.topic && q.topic.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full flex-1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Standard Page Header */}
        <PageHeader
          title="Quizzes"
          description={
            quizzes.length > 0
              ? `${quizzes.length} ${quizzes.length === 1 ? 'quiz' : 'quizzes'} available for knowledge assessment`
              : 'Assess retention and benchmark recall accuracy with AI-generated tests'
          }
          actions={
            <Button
              variant="ai"
              size="md"
              onClick={() => setIsGenerateOpen(true)}
              className="gap-2 w-full sm:w-auto min-h-[40px]"
            >
              <Sparkles size={15} />
              <span>Generate Quiz</span>
            </Button>
          }
        />

        {/* Filter / Search Bar */}
        {quizzes.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title or topic..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-surface-container border-2 border-border-default rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-56 rounded-xl border-2 border-border-default bg-surface-container-low/50 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to load quizzes"
            message={error}
            onRetry={fetchQuizzes}
          />
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon={<HelpCircle size={28} />}
            title="No quizzes yet"
            description="Generate your first quiz from your uploaded documents to challenge your knowledge and benchmark recall accuracy."
            action={
              <Button
                variant="ai"
                size="md"
                onClick={() => setIsGenerateOpen(true)}
                className="gap-2"
              >
                <Sparkles size={15} />
                <span>Generate Your First Quiz</span>
              </Button>
            }
          />
        ) : filteredQuizzes.length === 0 ? (
          <EmptyState
            title={`No quizzes match "${searchQuery}"`}
            description="Try changing or clearing your search term to see other quizzes."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold"
              >
                Clear search filter
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onRename={handleRename}
                onDelete={(id) => setDeleteTarget(quizzes.find((q) => q.id === id) || null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate Dialog */}
      <QuizGenerateDialog
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onSuccess={handleGenerateSuccess}
        preselectedDocumentId={preselectedDocId}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <QuizDeleteDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          quizTitle={deleteTarget.title}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
export default QuizzesView;
