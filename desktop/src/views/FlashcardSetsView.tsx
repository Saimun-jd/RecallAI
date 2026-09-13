import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BrainCircuit, Sparkles, Plus, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo-sm">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-on-surface">Flashcards</h1>
              <p className="text-xs text-on-surface-variant font-medium">
                {sets.length > 0 ? `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}` : 'Generate study sets from your documents'}
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
            Generate Flashcards
          </Button>
        </div>

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
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-error/10 text-error border-2 border-error/20 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <p className="text-sm font-bold text-on-surface">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchSets} className="gap-1.5">
              <RotateCcw size={13} /> Retry
            </Button>
          </div>
        ) : sets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo">
              <BrainCircuit size={32} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-on-surface">No flashcard sets yet</h2>
              <p className="text-sm text-on-surface-variant font-medium max-w-sm">
                Generate your first set of AI-powered flashcards from your study documents to begin active recall practice.
              </p>
            </div>
            <Button variant="ai" size="md" onClick={() => setIsGenerateOpen(true)} className="gap-2">
              <Sparkles size={15} />
              Generate Your First Set
            </Button>
          </div>
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
