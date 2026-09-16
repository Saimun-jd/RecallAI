import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HelpCircle, Sparkles, AlertCircle, RotateCcw, Search } from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo-sm">
              <HelpCircle size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-on-surface">Quizzes</h1>
              <p className="text-xs text-on-surface-variant font-medium">
                {quizzes.length > 0
                  ? `${quizzes.length} ${quizzes.length === 1 ? 'quiz' : 'quizzes'} available for assessment`
                  : 'Test your retention with AI-generated assessments'}
              </p>
            </div>
          </div>
          <Button
            variant="ai"
            size="md"
            onClick={() => setIsGenerateOpen(true)}
            className="gap-2"
          >
            <Sparkles size={15} />
            Generate Quiz
          </Button>
        </div>

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
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-error/10 text-error border-2 border-error/20 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <p className="text-sm font-bold text-on-surface">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchQuizzes} className="gap-1.5">
              <RotateCcw size={13} /> Retry
            </Button>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo">
              <HelpCircle size={32} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-on-surface">No quizzes yet</h2>
              <p className="text-sm text-on-surface-variant font-medium max-w-sm">
                Generate your first quiz from your uploaded documents to challenge your knowledge and benchmark recall accuracy.
              </p>
            </div>
            <Button variant="ai" size="md" onClick={() => setIsGenerateOpen(true)} className="gap-2">
              <Sparkles size={15} />
              Generate Your First Quiz
            </Button>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <p className="text-sm font-bold">No quizzes match "{searchQuery}"</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs"
            >
              Clear search filter
            </Button>
          </div>
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
