import React, { useState, useEffect, useCallback } from 'react';
import { client, 
  type DashboardSummaryResponse, 
  type StudyActivityResponse, 
  type ReviewDetailedStats, 
  type QuizPerformanceStats, 
  type DocumentLearningProgress, 
  type ConceptLearningProgress, 
  type StudySessionSummary 
} from '../api/client';
import { 
  ProgressHeader, 
  type ActivityTimeRange,
  ProgressSummaryCards, 
  StudyActivityChart, 
  RetentionAndStatesSection, 
  QuizPerformanceSection, 
  KnowledgeGrowthSection, 
  LearningGapsSection, 
  RecentStudySessions, 
  ProgressEmptyState 
} from '../components/progress';
import { RefreshCw } from 'lucide-react';
import { ErrorState } from '../components/shared/ErrorState';

export const ProgressView: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<ActivityTimeRange>('7d');
  
  // Data states
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [activity, setActivity] = useState<StudyActivityResponse | null>(null);
  const [reviewStats, setReviewStats] = useState<ReviewDetailedStats | null>(null);
  const [quizStats, setQuizStats] = useState<QuizPerformanceStats | null>(null);
  const [docsProgress, setDocsProgress] = useState<DocumentLearningProgress[]>([]);
  const [conceptsProgress, setConceptsProgress] = useState<ConceptLearningProgress[]>([]);
  const [sessions, setSessions] = useState<StudySessionSummary[]>([]);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // ── Fetch Activity when range changes ───────────────────────────
  const loadActivityData = useCallback(async (range: ActivityTimeRange) => {
    setIsActivityLoading(true);
    try {
      const act = await client.getLearningActivity(range);
      setActivity(act);
    } catch (err: any) {
      console.error('[ProgressView] Failed to load study activity:', err);
    } finally {
      setIsActivityLoading(false);
    }
  }, []);

  // ── Load full analytics payload ────────────────────────────────
  const loadAllData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setPageError(null);

    try {
      const [
        dashSummary,
        actData,
        revStats,
        qzStats,
        docProg,
        conceptProg,
        sessList,
      ] = await Promise.all([
        client.getLearningDashboard(),
        client.getLearningActivity(selectedRange),
        client.getLearningReviewStats().catch(() => null),
        client.getLearningQuizStats().catch(() => null),
        client.getDocumentLearningProgress(50, 0).catch(() => []),
        client.getConceptLearningProgress(50, 0).catch(() => []),
        client.getStudySessions(10, 0).catch(() => []),
      ]);

      setSummary(dashSummary);
      setActivity(actData);
      setReviewStats(revStats);
      setQuizStats(qzStats);
      setDocsProgress(docProg || []);
      setConceptsProgress(conceptProg || []);
      setSessions(sessList || []);
    } catch (err: any) {
      console.error('[ProgressView] Failed to load analytics dashboard:', err);
      setPageError(err?.userMessage || 'Failed to load learning progress data. Please ensure the backend is active.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRangeChange = (range: ActivityTimeRange) => {
    setSelectedRange(range);
    loadActivityData(range);
  };

  // ── Initial Page Skeleton ──────────────────────────────────────
  if (isLoading && !summary) {
    return (
      <div className="w-full flex-1 bg-surface p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-20 bg-surface-container/60 rounded-xl border border-border-default animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-surface-container/50 rounded-xl border border-border-default animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-surface-container/40 rounded-xl border border-border-default animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-surface-container/40 rounded-xl border border-border-default animate-pulse" />
          <div className="h-64 bg-surface-container/40 rounded-xl border border-border-default animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Page Level Error ───────────────────────────────────────────
  if (pageError && !summary) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-surface">
        <ErrorState
          title="Could Not Load Progress"
          message={pageError}
          onRetry={() => loadAllData()}
          className="max-w-md"
        />
      </div>
    );
  }

  // ── Empty State Check ──────────────────────────────────────────
  const isCompletelyEmpty =
    summary &&
    summary.review_workload.total_active === 0 &&
    summary.flashcards.total_cards === 0 &&
    summary.quizzes.total_attempts === 0 &&
    docsProgress.length === 0;

  return (
    <div className="w-full flex-1 bg-surface font-sans selection:bg-primary selection:text-white pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 1. Header */}
        <ProgressHeader
          selectedRange={selectedRange}
          onRangeChange={handleRangeChange}
          onRefresh={() => loadAllData(true)}
          isRefreshing={isRefreshing}
          dueCount={summary?.review_workload.due || 0}
        />

        {isCompletelyEmpty ? (
          <ProgressEmptyState />
        ) : (
          <>
            {/* 2. Top Summary Metric Cards */}
            {summary && <ProgressSummaryCards summary={summary} />}

            {/* 3. Continuous Study Activity Chart */}
            {activity && (
              <div className="relative">
                {isActivityLoading && (
                  <div className="absolute inset-0 bg-surface/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                    <div className="p-3 bg-surface-container-lowest border-2 border-border-default rounded-xl shadow-neo flex items-center gap-2 text-xs font-bold text-on-surface">
                      <RefreshCw size={14} className="animate-spin text-primary" /> Updating range...
                    </div>
                  </div>
                )}
                <StudyActivityChart activityData={activity} />
              </div>
            )}

            {/* 4. Retention & FSRS State Distribution */}
            {summary && (
              <RetentionAndStatesSection
                learningStates={summary.learning_states}
                reviewStats={reviewStats}
              />
            )}

            {/* 5. Quiz Assessment Performance */}
            {quizStats && <QuizPerformanceSection quizStats={quizStats} />}

            {/* 6. Learning Gaps & Attention Areas */}
            {summary && (
              <LearningGapsSection
                workload={summary.review_workload}
                documentsProgress={docsProgress}
                quizStats={quizStats}
              />
            )}

            {/* 7. Knowledge Growth & Document Progress */}
            <KnowledgeGrowthSection
              documentsProgress={docsProgress}
              conceptsProgress={conceptsProgress}
            />

            {/* 8. Recent Study Sessions Log */}
            <RecentStudySessions sessions={sessions} />
          </>
        )}
      </div>
    </div>
  );
};
