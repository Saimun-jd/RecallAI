import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import {
  client,
  type FlashcardSetDetailResponse,
  type ReviewSessionItem,
  type MaskedReviewItem,
  type RevealedReviewItem,
  type ReviewRating,
} from '../api/client';
import {
  StudyCard,
  RatingControls,
  StudyProgress,
  StudyCompletion,
} from '../components/flashcards';
import { Button } from '../components/ui/Button';
import { Dialog, DialogFooter } from '../components/ui/Dialog';
import { useToast } from '../hooks/useToast';

export function FlashcardStudyView() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [set, setSet] = useState<FlashcardSetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Session state (backend FSRS driven)
  const [session, setSession] = useState<ReviewSessionItem | null>(null);
  const [currentItem, setCurrentItem] = useState<MaskedReviewItem | RevealedReviewItem | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Fallback direct practice state (when backend queue has 0 due items)
  const [isDirectPractice, setIsDirectPractice] = useState(false);
  const [directIndex, setDirectIndex] = useState(0);

  // Exit confirmation dialog
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Initialize study session
  const initStudy = useCallback(async () => {
    if (!setId) return;
    setLoading(true);
    setError(null);
    setIsCompleted(false);
    setIsRevealed(false);
    setDirectIndex(0);

    try {
      // 1. Fetch set details
      const setData = await client.getFlashcardSet(setId);
      setSet(setData);

      if (setData.cards.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Start review session with backend
      try {
        const sessionData = await client.startReviewSession({
          limit: Math.max(setData.cards.length, 20),
          content_type: 'flashcard',
        });
        setSession(sessionData);

        if (sessionData.total_items > 0) {
          // Fetch first masked item
          const firstItem = await client.getNextReviewItem(sessionData.id);
          if (firstItem) {
            setCurrentItem(firstItem);
            setIsDirectPractice(false);
          } else {
            // Queue empty or already done
            setIsDirectPractice(true);
          }
        } else {
          // No due items in FSRS queue -> direct set practice mode
          setIsDirectPractice(true);
        }
      } catch (sessErr) {
        console.warn('Backend review session start failed, falling back to direct practice:', sessErr);
        setIsDirectPractice(true);
      }
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to start study session.');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    initStudy();
  }, [initStudy]);

  // Handle Reveal Answer
  const handleReveal = useCallback(async () => {
    if (isRevealed || isRevealing) return;

    if (isDirectPractice) {
      setIsRevealed(true);
      return;
    }

    if (!currentItem) return;

    setIsRevealing(true);
    try {
      const revealed = await client.revealReviewItem(currentItem.review_id);
      setCurrentItem(revealed);
      setIsRevealed(true);
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to reveal answer.');
    } finally {
      setIsRevealing(false);
    }
  }, [isRevealed, isRevealing, isDirectPractice, currentItem, showToast]);

  // Handle Rate
  const handleRate = useCallback(
    async (rating: ReviewRating) => {
      if (isSubmittingRating) return;

      if (isDirectPractice) {
        // Advance direct set card
        if (!set) return;
        const nextIdx = directIndex + 1;
        if (nextIdx >= set.cards.length) {
          setIsCompleted(true);
        } else {
          setDirectIndex(nextIdx);
          setIsRevealed(false);
        }
        return;
      }

      if (!session || !currentItem) return;

      setIsSubmittingRating(true);
      try {
        const rateResult = await client.rateReviewItem(currentItem.review_id, rating);
        setSession((prev) =>
          prev
            ? {
                ...prev,
                reviewed_items: rateResult.reviewed_items,
                total_items: rateResult.total_items,
                progress_percentage: Math.round(
                  (rateResult.reviewed_items / (rateResult.total_items || 1)) * 100
                ),
                status: rateResult.session_status,
              }
            : null
        );

        if (rateResult.session_status === 'completed') {
          setIsCompleted(true);
          return;
        }

        // Fetch next item
        const nextItem = await client.getNextReviewItem(session.id);
        if (!nextItem) {
          // Completed
          const completedSession = await client.completeReviewSession(session.id);
          setSession(completedSession);
          setIsCompleted(true);
        } else {
          setCurrentItem(nextItem);
          setIsRevealed(false);
        }
      } catch (err: any) {
        showToast('error', err?.userMessage || 'Failed to submit rating.');
      } finally {
        setIsSubmittingRating(false);
      }
    },
    [isSubmittingRating, isDirectPractice, set, directIndex, session, currentItem, showToast]
  );

  // Keyboard shortcut for reveal (Space or Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRevealed || isRevealing || isCompleted || loading) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleReveal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, isRevealing, isCompleted, loading, handleReveal]);

  // Handle Exit
  const handleExit = () => {
    const hasProgress = isDirectPractice
      ? directIndex > 0
      : (session?.reviewed_items || 0) > 0;

    if (!isCompleted && hasProgress) {
      setShowExitConfirm(true);
    } else {
      navigate(`/app/flashcards/${setId}`);
    }
  };

  const handleConfirmExit = async () => {
    if (session && !isDirectPractice && session.status === 'active') {
      try {
        await client.abandonReviewSession(session.id);
      } catch (e) {
        console.warn('Abandon session failed:', e);
      }
    }
    navigate(`/app/flashcards/${setId}`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm font-bold text-on-surface">Preparing study session...</p>
      </div>
    );
  }

  if (error || !set) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-error/10 text-error border-2 border-error/20 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <p className="text-sm font-bold text-on-surface">{error || 'Flashcard set not found'}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={initStudy} className="gap-1.5">
            <RotateCcw size={13} /> Retry
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/app/flashcards')}>
            Back to Flashcards
          </Button>
        </div>
      </div>
    );
  }

  if (set.cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo-sm">
          <BrainCircuit size={24} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-black text-on-surface">No cards to study</h2>
          <p className="text-xs text-on-surface-variant max-w-xs">
            This flashcard set does not have any cards yet.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate(`/app/flashcards/${set.id}`)}>
          Back to Set
        </Button>
      </div>
    );
  }

  // Completion State
  if (isCompleted) {
    const completedSession: ReviewSessionItem = session || {
      id: 'direct-session',
      workspace_id: set.workspace_id,
      user_id: set.user_id,
      status: 'completed',
      started_at: new Date(Date.now() - set.cards.length * 5000).toISOString(),
      completed_at: new Date().toISOString(),
      total_items: set.cards.length,
      reviewed_items: set.cards.length,
      progress_percentage: 100,
    };

    return (
      <div className="flex-1 overflow-y-auto py-8">
        <StudyCompletion
          session={completedSession}
          setId={set.id}
          setTitle={set.title}
        />
      </div>
    );
  }

  // Active Card Data
  const currentCardData = isDirectPractice
    ? {
        review_id: `direct-${set.cards[directIndex].id}`,
        session_id: 'direct-session',
        learning_item_id: set.cards[directIndex].id,
        content_type: 'flashcard',
        content_id: set.cards[directIndex].id,
        front: set.cards[directIndex].front,
        back: set.cards[directIndex].back,
        source_metadata: set.cards[directIndex].source_metadata,
        order_index: directIndex,
        status: 'pending',
        revealed: isRevealed,
      }
    : currentItem;

  const totalCards = isDirectPractice ? set.cards.length : session?.total_items || set.cards.length;
  const reviewedCards = isDirectPractice ? directIndex : session?.reviewed_items || 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Top Study Header */}
      <header className="shrink-0 border-b-2 border-border-default/80 bg-surface/90 backdrop-blur-md px-4 sm:px-6 py-3.5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="gap-1.5 text-on-surface-variant hover:text-on-surface"
            aria-label="Exit study session"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline font-bold">Exit</span>
          </Button>

          <div className="text-center min-w-0 flex-1 px-2">
            <h1 className="text-sm font-black text-on-surface truncate">
              {set.title}
            </h1>
            {isDirectPractice && (
              <span className="text-[10px] font-bold text-on-surface-variant/80">
                Self-paced practice
              </span>
            )}
          </div>

          <div className="w-16 flex justify-end">
            <span className="text-xs font-black text-primary tabular-nums">
              {reviewedCards + 1}/{totalCards}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-2.5">
          <StudyProgress reviewed={reviewedCards} total={totalCards} />
        </div>
      </header>

      {/* Main Study Card Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto w-full">
        {currentCardData ? (
          <>
            <StudyCard
              item={currentCardData as any}
              isRevealed={isRevealed}
              onReveal={handleReveal}
              isRevealing={isRevealing}
            />

            {/* Rating Controls (visible when revealed) */}
            {isRevealed && (
              <div className="w-full motion-safe:animate-[fade-in_0.2s_ease-out]">
                <RatingControls
                  onRate={handleRate}
                  isSubmitting={isSubmittingRating}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-3">
            <Loader2 size={24} className="animate-spin text-primary mx-auto" />
            <p className="text-sm text-on-surface-variant font-medium">Loading next card...</p>
          </div>
        )}
      </main>

      {/* Exit Confirmation Dialog */}
      <Dialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        title="Leave Study Session?"
      >
        <div className="space-y-2 text-sm text-on-surface-variant">
          <p>
            You have reviewed {reviewedCards} out of {totalCards} cards in this session.
          </p>
          <p>
            Your completed reviews and memory ratings are safely saved, but your current session will end.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" size="md" onClick={() => setShowExitConfirm(false)}>
            Continue Studying
          </Button>
          <Button variant="outline" size="md" onClick={handleConfirmExit} className="text-error border-error/30 hover:bg-error/10">
            Exit Session
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
