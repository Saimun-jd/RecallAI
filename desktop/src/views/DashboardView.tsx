import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Upload, Loader2, Sparkles, Plus, BookOpen, BrainCircuit } from 'lucide-react';
import { 
  client, 
  type DashboardSummaryResponse, 
  type DocumentItem, 
  type StudyActivityResponse, 
  type AccountOverviewResponse, 
  type ReviewWorkloadStats 
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import type { RootState } from '../store';
import { setBooks, setCloudUploadState, setIsUploading, setIngestionProgress } from '../store';
import { supabase } from '../lib/supabase';
import { IngestionProgressModal } from './IngestionProgressModal';
import { 
  DashboardHeader, 
  NextActionCard, 
  KnowledgeOverview, 
  PriorityReviewCard, 
  RecentKnowledgeList, 
  ContinueLearningCard, 
  ProgressSnapshot, 
  UsageQuotaCard, 
  DashboardSkeleton 
} from '../components/dashboard';

const defaultWorkload: ReviewWorkloadStats = {
  due: 0,
  overdue: 0,
  new: 0,
  total_active: 0,
};

export function DashboardView() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isUploading, ingestionProgress } = useSelector((state: RootState) => state.library);
  const sidecarStatus = useSelector((state: RootState) => state.system.sidecarStatus);

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardSummaryResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [activityData, setActivityData] = useState<StudyActivityResponse | null>(null);
  const [accountOverview, setAccountOverview] = useState<AccountOverviewResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Execute resilient parallel queries with Promise.allSettled
      const [dashRes, docsRes, actRes, accRes, booksRes] = await Promise.allSettled([
        client.getLearningDashboard(),
        client.getDocuments(5, 0),
        client.getStudyActivity('7d'),
        client.getAccountOverview(),
        client.getBooks(),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value);
      }

      if (actRes.status === 'fulfilled') {
        setActivityData(actRes.value);
      }

      if (accRes.status === 'fulfilled') {
        setAccountOverview(accRes.value);
      }

      // Check documents from API v1 and merge with local books
      let resolvedDocs: DocumentItem[] = [];
      let resolvedTotal = 0;

      const booksList = booksRes.status === 'fulfilled' && Array.isArray(booksRes.value) ? booksRes.value : [];
      if (booksList.length > 0) {
        dispatch(setBooks(booksList));
      }

      if (docsRes.status === 'fulfilled' && docsRes.value?.documents) {
        resolvedDocs = docsRes.value.documents.map((item) => {
          const matchingBook = booksList.find((b: any) =>
            b.id.toString() === item.id ||
            item.metadata?.book_id === b.id ||
            b.title.toLowerCase().trim() === item.title.toLowerCase().trim()
          );
          if (matchingBook) {
            return {
              ...item,
              metadata: {
                ...item.metadata,
                book_id: matchingBook.id,
              },
            };
          }
          return item;
        });
        resolvedTotal = docsRes.value.total;
      }

      // Merge local books that aren't yet in resolvedDocs
      if (booksList.length > 0) {
        const legacyItems: DocumentItem[] = booksList
          .filter((b: any) => !resolvedDocs.some((d) => d.id === b.id.toString() || d.metadata?.book_id === b.id))
          .map((b: any) => ({
            id: b.id.toString(),
            workspace_id: 'default',
            title: b.title,
            source_type: 'pdf',
            total_pages: b.total_pages || 0,
            status: 'ready',
            created_at: b.created_at,
            updated_at: b.created_at,
            metadata: {
              book_id: b.id,
              chunk_count: b.topics_processed || b.total_topics,
            },
          }));
        resolvedDocs = [...resolvedDocs, ...legacyItems];
        resolvedTotal = Math.max(resolvedTotal, resolvedDocs.length);
      }

      setDocuments(resolvedDocs);
      setTotalDocuments(resolvedTotal);
    } catch (err: any) {
      console.error('[Dashboard] Error fetching aggregated metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Upload handler matching existing client pipeline
  const processFile = async (file: File) => {
    dispatch(setIsUploading(true));
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (accountOverview?.usage?.documents?.limit && totalDocuments >= accountOverview.usage.documents.limit) {
        showToast('error', `Upload limit reached. Your plan allows up to ${accountOverview.usage.documents.limit} documents.`);
        dispatch(setIsUploading(false));
        return;
      }

      const MAX_CLOUD_SIZE = 200 * 1024 * 1024;
      const isOversized = file.size > MAX_CLOUD_SIZE;

      if (isOversized) {
        showToast('warning', 'File is too large for cloud backup. It will only be saved locally.');
      }

      const fileHash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const res = await client.uploadPdfAndGetToc(file, file.name.replace('.pdf', ''), 0);
      showToast('success', 'Document uploaded successfully. Generating knowledge chunks...');
      await fetchDashboardData();
      navigate(`/books/${res.book_id}`);

      // Background cloud upload if session exists
      if (!isOversized && session) {
        const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/user_pdfs/${session.user.id}/${fileHash}.pdf`;
        dispatch(setCloudUploadState({ isUploading: true, progress: 0, fileName: file.name }));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('x-upsert', 'true');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            dispatch(setCloudUploadState({ isUploading: true, progress: percent, fileName: file.name }));
          }
        };

        xhr.onload = () => {
          dispatch(setCloudUploadState(null));
        };
        xhr.onerror = () => {
          dispatch(setCloudUploadState(null));
        };
        xhr.send(file);
      }
    } catch (err: any) {
      console.error('[Dashboard] File upload error:', err);
      showToast('error', err?.userMessage || 'Failed to upload document.', err?.debugDetail);
    } finally {
      dispatch(setIsUploading(false));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('warning', 'Please drop a valid PDF file.');
      return;
    }
    processFile(file);
  };

  const handleProgressComplete = () => {
    dispatch(setIngestionProgress(null));
    navigate('/review');
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const workload = dashboardData?.review_workload || defaultWorkload;
  const readyDocs = documents.filter((d) => d.status === 'ready');
  const mostRecentDoc = readyDocs[0] || documents[0] || null;

  return (
    <div
      className={`flex-1 overflow-y-auto bg-surface text-on-surface transition-colors ${
        isDragging
          ? 'bg-primary/5 outline-dashed outline-4 outline-primary outline-offset-[-16px]'
          : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
          <div className="p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo-lg text-center space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto border-2 border-border-default shadow-neo-sm">
              <Upload size={28} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black text-on-surface">Drop PDF to Ingest</h2>
            <p className="text-xs text-on-surface-variant max-w-xs">
              Recall AI will automatically parse sections, extract concepts, and generate study cards.
            </p>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        accept="application/pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Dashboard Layout */}
      <div className="p-5 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* 1. Dashboard Context Header */}
        <DashboardHeader
          userName={user?.full_name}
          dueReviewCount={workload.due}
          onUploadClick={() => fileInputRef.current?.click()}
        />

        {/* 2. Primary Next Action Decision Engine */}
        <NextActionCard
          totalDocuments={totalDocuments}
          documents={documents}
          reviewWorkload={workload}
          onUploadClick={() => fileInputRef.current?.click()}
        />

        {/* 3. Knowledge & Learning Overview Metrics */}
        <KnowledgeOverview
          totalDocuments={totalDocuments}
          dashboardData={dashboardData}
        />

        {/* 4. Two-Column Review Priority & Recent Knowledge */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PriorityReviewCard
            workload={workload}
            learningStates={dashboardData?.learning_states}
          />
          <RecentKnowledgeList
            documents={documents}
            totalDocuments={totalDocuments}
            onUploadClick={() => fileInputRef.current?.click()}
          />
        </div>

        {/* 5. Three-Column Continuation, Consistency & Quotas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ContinueLearningCard recentDocument={mostRecentDoc} />
          <ProgressSnapshot activityData={activityData} />
          <UsageQuotaCard overview={accountOverview} />
        </div>
      </div>

      {/* Ingestion Modal */}
      <IngestionProgressModal
        isOpen={!!ingestionProgress}
        progress={ingestionProgress!}
        onComplete={handleProgressComplete}
      />
    </div>
  );
}
