import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BrainCircuit, Sparkles } from 'lucide-react';
import {
  client,
  type FlashcardSetItem,
  type FlashcardSetDetailResponse,
} from '../api/client';
import {
  FlashcardSetCard,
  FlashcardGenerateDialog,
  FlashcardSetDeleteDialog,
} from '../components/flashcards';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState, ErrorState } from '../components/shared';
import { useToast } from '../hooks/useToast';

export function FlashcardSetsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [sets, setSets] = useState<FlashcardSetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const preselectedDocId = searchParams.get('document_id') || null;

  const [deleteTarget, setDeleteTarget] = useState<FlashcardSetItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  const fetchSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await client.listFlashcardSets(50, 0);
      setSets(resp.sets);
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to load flashcard sets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

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

  const handleGenerateSuccess = (newSet: FlashcardSetDetailResponse) => {
    setSets((prev) => [newSet, ...prev]);
    // Navigate to the new set
    setTimeout(() => navigate(`/app/flashcards/${newSet.id}`), 300);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await client.deleteFlashcardSet(deleteTarget.id);
      setSets((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      showToast('success', `"${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to delete flashcard set.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async (id: string) => {
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    const newTitle = window.prompt('Rename flashcard set:', set.title);
    if (!newTitle || newTitle.trim() === set.title) return;
    try {
      const updated = await client.updateFlashcardSet(id, { title: newTitle.trim() });
      setSets((prev) => prev.map((s) => (s.id === id ? { ...s, title: updated.title } : s)));
      showToast('success', 'Set renamed.');
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to rename set.');
    }
  };

  return (
    <div className="w-full flex-1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Standard Page Header */}
        <PageHeader
          title="Flashcards"
          description={
            sets.length > 0
              ? `${sets.length} ${sets.length === 1 ? 'set' : 'sets'} available for active recall practice`
              : 'Generate and manage study sets from your knowledge documents'
          }
          actions={
            <Button
              variant="ai"
              size="md"
              onClick={() => setIsGenerateOpen(true)}
              className="gap-2 w-full sm:w-auto min-h-[40px]"
            >
              <Sparkles size={15} />
              <span>Generate Flashcards</span>
            </Button>
          }
        />

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl border-2 border-border-default bg-surface-container-low/50 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to load flashcard sets"
            message={error}
            onRetry={fetchSets}
          />
        ) : sets.length === 0 ? (
          <EmptyState
            icon={<BrainCircuit size={28} />}
            title="No flashcard sets yet"
            description="Generate your first set of AI-powered flashcards from your study documents to begin active recall practice."
            action={
              <Button
                variant="ai"
                size="md"
                onClick={() => setIsGenerateOpen(true)}
                className="gap-2"
              >
                <Sparkles size={15} />
                <span>Generate Your First Set</span>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map((set) => (
              <FlashcardSetCard
                key={set.id}
                set={set}
                onRename={handleRename}
                onDelete={(id) => setDeleteTarget(sets.find((s) => s.id === id) || null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate Dialog */}
      <FlashcardGenerateDialog
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onSuccess={handleGenerateSuccess}
        preselectedDocumentId={preselectedDocId}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <FlashcardSetDeleteDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          setTitle={deleteTarget.title}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
