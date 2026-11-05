import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BrainCircuit,
  Play,
  Pencil,
  Trash2,
  Sparkles,
  BookOpen,
  Calendar,
  Check,
  X,
} from 'lucide-react';
import {
  client,
  type FlashcardSetDetailResponse,
} from '../api/client';
import {
  FlashcardCardPreview,
  FlashcardGenerateDialog,
  FlashcardSetDeleteDialog,
} from '../components/flashcards';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ErrorState } from '../components/shared';
import { Tag } from '../components/ui/Tag';
import { useToast } from '../hooks/useToast';

export function FlashcardSetDetailView() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [set, setSet] = useState<FlashcardSetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline rename state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Dialogs
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSetDetail = useCallback(async () => {
    if (!setId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.getFlashcardSet(setId);
      setSet(data);
      setEditTitleValue(data.title);
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to load flashcard set.');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    fetchSetDetail();
  }, [fetchSetDetail]);

  const handleSaveTitle = async () => {
    if (!set || !editTitleValue.trim() || editTitleValue.trim() === set.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      const updated = await client.updateFlashcardSet(set.id, { title: editTitleValue.trim() });
      setSet((prev) => (prev ? { ...prev, title: updated.title } : null));
      setIsEditingTitle(false);
      showToast('success', 'Set renamed.');
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to rename set.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!set) return;
    setIsDeleting(true);
    try {
      await client.deleteFlashcardSet(set.id);
      showToast('success', `"${set.title}" deleted.`);
      navigate('/app/flashcards');
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to delete flashcard set.');
      setIsDeleting(false);
    }
  };

  const handleGenerateSuccess = () => {
    fetchSetDetail();
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="h-8 w-24 bg-surface-container-low/50 rounded animate-pulse" />
          <div className="h-32 border-2 border-border-default rounded-2xl bg-surface-container-low/50 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 border-2 border-border-default rounded-xl bg-surface-container-low/50 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !set) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <ErrorState
          title="Flashcard Set Not Found"
          message={error || 'The requested flashcard set could not be loaded.'}
          onRetry={fetchSetDetail}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/flashcards')}
              className="gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Sets
            </Button>
          }
        />
      </div>
    );
  }

  const formattedDate = new Date(set.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: 'Flashcards', href: '/app/flashcards' },
              { label: set.title },
            ]}
          />

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateOpen(true)}
              className="gap-1.5"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Add Cards</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-1.5 text-error hover:bg-error/10 hover:border-error/30"
              aria-label="Delete set"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>

        {/* Set Header Card */}
        <div className="border-2 border-border-default rounded-2xl bg-surface p-6 sm:p-8 shadow-neo space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shrink-0 shadow-neo-sm">
                <BrainCircuit size={24} />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 max-w-lg">
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') {
                          setEditTitleValue(set.title);
                          setIsEditingTitle(false);
                        }
                      }}
                      autoFocus
                      disabled={isSavingTitle}
                      className="text-lg sm:text-xl font-black text-on-surface bg-surface-container border-2 border-primary rounded-lg px-3 py-1 outline-none w-full"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      disabled={isSavingTitle}
                      className="p-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                      aria-label="Save title"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitleValue(set.title);
                        setIsEditingTitle(false);
                      }}
                      className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
                      aria-label="Cancel editing"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <h1 className="text-xl sm:text-2xl font-black text-on-surface leading-tight break-words">
                      {set.title}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(true)}
                      className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container opacity-0 group-hover/title:opacity-100 transition-opacity"
                      aria-label="Rename set"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                {set.description && (
                  <p className="text-xs sm:text-sm text-on-surface-variant font-medium leading-relaxed">
                    {set.description}
                  </p>
                )}
              </div>
            </div>

            {/* Study Primary Action */}
            <div className="shrink-0 pt-2 sm:pt-0">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(`/app/flashcards/${set.id}/study`)}
                disabled={set.cards.length === 0}
                className="w-full sm:w-auto gap-2 text-base font-black px-6 shadow-neo hover:shadow-neo-lg"
              >
                <Play size={18} />
                <span>Study Now</span>
              </Button>
            </div>
          </div>

          {/* Badges / Metadata */}
          <div className="flex items-center gap-2.5 flex-wrap pt-4 border-t border-border-default/50">
            <Tag variant="primary" size="sm">
              {set.cards.length} {set.cards.length === 1 ? 'card' : 'cards'}
            </Tag>
            {set.source_document_ids.length > 0 && (
              <Tag variant="default" size="sm">
                <BookOpen size={11} className="shrink-0" />
                <span>{set.source_document_ids.length} {set.source_document_ids.length === 1 ? 'source document' : 'source documents'}</span>
              </Tag>
            )}
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium ml-auto">
              <Calendar size={12} className="opacity-60" />
              <span>Updated {formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-on-surface">
              Flashcards ({set.cards.length})
            </h2>
            <span className="text-xs text-on-surface-variant font-medium">
              Click cards to preview answers
            </span>
          </div>

          {set.cards.length === 0 ? (
            <div className="border-2 border-dashed border-border-default rounded-2xl p-12 text-center space-y-4 bg-surface-container-low/30">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto">
                <Sparkles size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-on-surface">No cards in this set</h3>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Generate flashcards from your documents to populate this study set.
                </p>
              </div>
              <Button
                variant="ai"
                size="sm"
                onClick={() => setIsGenerateOpen(true)}
                className="gap-1.5"
              >
                <Sparkles size={13} />
                Generate Cards
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {set.cards.map((card, idx) => (
                <FlashcardCardPreview
                  key={card.id}
                  card={card}
                  index={idx}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate Dialog */}
      <FlashcardGenerateDialog
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onSuccess={handleGenerateSuccess}
        preselectedDocumentId={set.source_document_ids?.[0] || null}
      />

      {/* Delete Confirmation Dialog */}
      <FlashcardSetDeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        setTitle={set.title}
        isDeleting={isDeleting}
      />
    </div>
  );
}
