import React, { useEffect, useState, useCallback } from 'react';
import {
  client,
  type ReviewQueueItem,
  type ReviewSessionItem,
  type ReviewStatistics,
  type MaskedReviewItem,
  type RevealedReviewItem,
  type ReviewRating,
} from '../api/client';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/ui/Button';
import {
  ReviewQueueSummary,
  ReviewEmptyState,
  ReviewActiveSession,
  ReviewCompletion,
} from '../components/review';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';

type ReviewViewMode = 'loading' | 'landing' | 'session' | 'completed' | 'error';

const SESSION_STORAGE_KEY = 'recall_active_review_session_id';

export function ReviewView() {
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<ReviewViewMode>('loading');
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [statistics, setStatistics] = useState<ReviewStatistics | null>(null);
  const [activeSession, setActiveSession] = useState<ReviewSessionItem | null>(null);
  const [currentItem, setCurrentItem] = useState<MaskedReviewItem | RevealedReviewItem | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── 1. Fetch Due Queue & Statistics ─────────────────────────────
  const loadReviewData = useCallback(async (isSilent = false) => {
    if (!isSilent) setViewMode('loading');
    setErrorMessage(null);

    try {
      const [queueData, statsData] = await Promise.all([
        client.getReviewQueue(50),
        client.getReviewStatistics(),
      ]);

      setQueue(queueData || []);
      setStatistics(statsData || null);

      // Check for an active session stored in sessionStorage
      const savedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSessionId) {
        try {
          const sessionDetails = await client.getReviewSession(savedSessionId);
          if (sessionDetails && sessionDetails.status === 'active') {
            setActiveSession(sessionDetails);
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setActiveSession(null);
          }
        } catch {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setActiveSession(null);
        }
      }

      setViewMode('landing');
    } catch (err: any) {
      console.error('[ReviewView] Failed to load review queue or stats:', err);
      const msg = err?.userMessage || 'Failed to load spaced repetition review queue.';
      setErrorMessage(msg);
      setViewMode('error');
      showToast('error', msg, err?.debugDetail);
    }
  }, [showToast]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  // ── 2. Start Review Session ─────────────────────────────────────
  const handleStartReview = async (limit: number) => {
    setIsStarting(true);
    setRatingError(null);

    try {
      const session = await client.startReviewSession({
        limit,
      });

      if (!session || session.status === 'completed' || session.total_items === 0) {
        showToast('info', 'No due cards available for review in this session.');
        await loadReviewData(true);
        return;
      }

      sessionStorage.setItem(SESSION_STORAGE_KEY, session.id);
      setActiveSession(session);

      // Fetch the first masked card from the authoritative backend
      const nextCard = await client.getNextReviewItem(session.id);
      if (nextCard) {
        setCurrentItem(nextCard);
        setIsRevealed(false);
        setViewMode('session');
      } else {
        // Session has no pending items
        await client.completeReviewSession(session.id);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setViewMode('completed');
      }
    } catch (err: any) {
      console.error('[ReviewView] Failed to start review session:', err);
      showToast('error', err?.userMessage || 'Failed to start review session.', err?.debugDetail);
    } finally {
      setIsStarting(false);
    }
  };

  // ── 3. Resume Active Session ────────────────────────────────────
  const handleResumeSession = async () => {
    if (!activeSession) return;
    setIsStarting(true);
    setRatingError(null);

    try {
      const nextCard = await client.getNextReviewItem(activeSession.id);
      if (nextCard) {
        setCurrentItem(nextCard);
        setIsRevealed(false);
        setViewMode('session');
      } else {
        // Active session is actually finished
        const completed = await client.completeReviewSession(activeSession.id);
        setActiveSession(completed);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setViewMode('completed');
      }
    } catch (err: any) {
      console.error('[ReviewView] Failed to resume session:', err);
      showToast('error', err?.userMessage || 'Failed to resume session.', err?.debugDetail);
    } finally {
      setIsStarting(false);
    }
  };

  // ── 4. Abandon Session ──────────────────────────────────────────
  const handleAbandonSession = async () => {
    if (!activeSession) return;
    setIsAbandoning(true);

    try {
      await client.abandonReviewSession(activeSession.id);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setActiveSession(null);
      showToast('info', 'Review session abandoned. Progress was preserved.');
      await loadReviewData(true);
      setViewMode('landing');
    } catch (err: any) {
      console.error('[ReviewView] Failed to abandon session:', err);
      showToast('error', err?.userMessage || 'Failed to abandon review session.', err?.debugDetail);
    } finally {
      setIsAbandoning(false);
    }
  };

  // ── 5. Complete Session Early ───────────────────────────────────
  const handleCompleteEarly = async () => {
    if (!activeSession) return;
    try {
      const completed = await client.completeReviewSession(activeSession.id);
      setActiveSession(completed);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setViewMode('completed');
    } catch (err: any) {
      console.error('[ReviewView] Failed to complete session early:', err);
      showToast('error', err?.userMessage || 'Failed to complete review session.', err?.debugDetail);
    }
  };

  // ── 6. Reveal Card Answer ───────────────────────────────────────
  const handleReveal = async () => {
    if (!currentItem || isRevealing || isRevealed) return;
    setIsRevealing(true);

    try {
      const revealed = await client.revealReviewItem(currentItem.review_id);
      setCurrentItem(revealed);
      setIsRevealed(true);
    } catch (err: any) {
      console.error('[ReviewView] Failed to reveal answer:', err);
      showToast('error', err?.userMessage || 'Failed to reveal answer.', err?.debugDetail);
    } finally {
      setIsRevealing(false);
    }
  };

  // ── 7. Rate Card (FSRS Controlled Rating) ───────────────────────
  const handleRate = async (rating: ReviewRating) => {
    if (!currentItem || !activeSession || isRating) return;
    setIsRating(true);
    setRatingError(null);

    try {
      const rateResult = await client.rateReviewItem(currentItem.review_id, rating);

      // Update local session metrics directly from server response
      const updatedSession: ReviewSessionItem = {
        ...activeSession,
        reviewed_items: rateResult.reviewed_items,
        total_items: rateResult.total_items,
        status: rateResult.session_status,
      };
      setActiveSession(updatedSession);

      // Check if session finished according to the backend
      if (rateResult.session_status === 'completed' || rateResult.reviewed_items >= rateResult.total_items) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setViewMode('completed');
        return;
      }

      // Fetch next card from backend
      const nextCard = await client.getNextReviewItem(activeSession.id);
      if (nextCard) {
        setCurrentItem(nextCard);
        setIsRevealed(false);
      } else {
        // No more cards in session
        const finished = await client.completeReviewSession(activeSession.id);
        setActiveSession(finished);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setViewMode('completed');
      }
    } catch (err: any) {
      console.error('[ReviewView] Rating failed:', err);
      const msg = err?.userMessage || 'Failed to record recall rating. Please retry.';
      setRatingError(msg);
      showToast('error', msg, err?.debugDetail);
    } finally {
      setIsRating(false);
    }
  };

  // ── 8. Return to Review Queue after Completion ──────────────────
  const handleReturnToQueue = async () => {
    setCurrentItem(null);
    setIsRevealed(false);
    setActiveSession(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    await loadReviewData();
  };

  // ── 9. Refresh Queue Button in Empty State ──────────────────────
  const handleRefreshQueue = async () => {
    setIsRefreshing(true);
    try {
      await loadReviewData(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Loading Skeleton ────────────────────────────────────────────
  if (viewMode === 'loading') {
    return (
      <LoadingState
        variant="page"
        message="Loading spaced review queue..."
        description="Consulting FSRS memory schedule and active recall deck..."
      />
    );
  }

  // ── Error State ─────────────────────────────────────────────────
  if (viewMode === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface">
        <ErrorState
          title="Unable to load Review Queue"
          message={errorMessage || 'Failed to communicate with the review scheduler.'}
          onRetry={() => loadReviewData()}
          className="max-w-md"
        />
      </div>
    );
  }

  // ── Active Session State ────────────────────────────────────────
  if (viewMode === 'session' && activeSession && currentItem) {
    return (
      <div className="w-full flex-1 bg-surface p-4 sm:p-8">
        <ReviewActiveSession
          session={activeSession}
          currentItem={currentItem}
          isRevealed={isRevealed}
          onReveal={handleReveal}
          onRate={handleRate}
          onCompleteEarly={handleCompleteEarly}
          onAbandon={handleAbandonSession}
          isRevealing={isRevealing}
          isRating={isRating}
          ratingError={ratingError}
        />
      </div>
    );
  }

  // ── Session Completion State ────────────────────────────────────
  if (viewMode === 'completed' && activeSession) {
    return (
      <div className="w-full flex-1 bg-surface p-4 sm:p-8">
        <ReviewCompletion
          session={activeSession}
          onReturnToQueue={handleReturnToQueue}
        />
      </div>
    );
  }

  // ── Landing State: Caught Up (Empty Queue) ──────────────────────
  const isCaughtUp = queue.length === 0 && (!statistics || statistics.due_count === 0);

  if (isCaughtUp && (!activeSession || activeSession.status !== 'active')) {
    return (
      <div className="w-full flex-1 bg-surface p-4 sm:p-8">
        <ReviewEmptyState
          statistics={statistics}
          onRefreshQueue={handleRefreshQueue}
          isRefreshing={isRefreshing}
        />
      </div>
    );
  }

  // ── Landing State: Due Cards Queue Summary ──────────────────────
  return (
    <div className="w-full flex-1 bg-surface p-4 sm:p-8">
      <ReviewQueueSummary
        queue={queue}
        statistics={statistics}
        onStartReview={handleStartReview}
        activeSession={activeSession}
        onResumeSession={handleResumeSession}
        onAbandonSession={handleAbandonSession}
        isStarting={isStarting}
        isAbandoning={isAbandoning}
      />
    </div>
  );
}
