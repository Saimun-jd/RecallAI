import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, ArrowUpDown, BookOpen, 
  Upload, Layers, RefreshCw, AlertCircle 
} from 'lucide-react';
import { 
  client, 
  type DocumentItem, 
  type DocumentStatusResponse, 
  type DocumentUploadResponse 
} from '../api/client';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/ui/Button';
import { 
  DocumentCard, 
  DocumentDeleteDialog, 
  DocumentListSkeleton, 
  UploadDocumentModal 
} from '../components/documents';

export function DocumentsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, DocumentStatusResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('newest');

  const pollingTimerRef = useRef<any>(null);

  // 1. Fetch workspace documents (with offline SQLite fallback)
  const fetchDocuments = useCallback(async () => {
    try {
      const [v1Res, booksRes] = await Promise.allSettled([
        client.getDocuments(100, 0),
        client.getBooks(),
      ]);

      let items: DocumentItem[] = [];

      if (v1Res.status === 'fulfilled' && v1Res.value?.documents) {
        items = [...v1Res.value.documents];
      }

      // Merge legacy books if running offline/local
      if (booksRes.status === 'fulfilled' && Array.isArray(booksRes.value)) {
        const legacyItems: DocumentItem[] = booksRes.value
          .filter((b: any) => !items.some((d) => d.id === b.id.toString()))
          .map((b: any) => ({
            id: b.id.toString(),
            workspace_id: 'default',
            title: b.title,
            source_type: 'pdf',
            total_pages: b.total_pages || 1,
            status: 'ready',
            created_at: b.created_at || new Date().toISOString(),
            updated_at: b.created_at || new Date().toISOString(),
            metadata: {
              chunk_count: b.topics_processed || b.total_topics,
            },
          }));
        items = [...items, ...legacyItems];
      }

      setDocuments(items);
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
      showToast('error', 'Failed to load documents list.');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 2. Poll in-progress documents until terminal state
  useEffect(() => {
    const activeProcessingDocs = documents.filter((doc) => {
      const st = liveStatuses[doc.id]?.status || doc.status;
      return st === 'processing' || st === 'uploading';
    });

    if (activeProcessingDocs.length === 0) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    const pollStatuses = async () => {
      const updates: Record<string, DocumentStatusResponse> = {};
      let hasTransitions = false;

      await Promise.all(
        activeProcessingDocs.map(async (doc) => {
          try {
            const statusRes = await client.getDocumentStatus(doc.id);
            updates[doc.id] = statusRes;
            if (statusRes.status === 'ready' || statusRes.status === 'failed') {
              hasTransitions = true;
            }
          } catch {
            // Ignore temporary polling errors
          }
        })
      );

      setLiveStatuses((prev) => ({ ...prev, ...updates }));

      if (hasTransitions) {
        fetchDocuments();
      }
    };

    pollingTimerRef.current = setInterval(pollStatuses, 2500);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [documents, liveStatuses, fetchDocuments]);

  // 3. Search, filter, and sort calculation
  const filteredAndSortedDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const currentStatus = liveStatuses[doc.id]?.status || doc.status;

        // Search query
        const matchesQuery =
          !searchQuery.trim() ||
          doc.title.toLowerCase().includes(searchQuery.toLowerCase());

        // Status filter
        let matchesStatus = true;
        if (statusFilter === 'ready') matchesStatus = currentStatus === 'ready';
        else if (statusFilter === 'processing') {
          matchesStatus = currentStatus === 'processing' || currentStatus === 'uploading';
        } else if (statusFilter === 'failed') {
          matchesStatus = currentStatus === 'failed';
        }

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'alpha') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [documents, liveStatuses, searchQuery, statusFilter, sortBy]);

  // 4. Action Handlers
  const handleOpenDocument = (docId: string) => {
    navigate(`/documents/${docId}`);
  };

  const handleUploadSuccess = (uploaded: DocumentUploadResponse) => {
    showToast('success', `"${uploaded.filename}" uploaded successfully!`);
    const newDoc: DocumentItem = {
      id: uploaded.document_id,
      workspace_id: 'default',
      title: uploaded.filename.replace(/\.[^/.]+$/, ''),
      source_type: uploaded.filename.endsWith('.pdf') ? 'pdf' : 'markdown',
      total_pages: 1,
      status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDocuments((prev) => [newDoc, ...prev]);
    fetchDocuments();
  };

  const handleRetryProcessing = async (docId: string) => {
    try {
      showToast('info', 'Restarting document processing...');
      await client.reindexDocument(docId);
      setLiveStatuses((prev) => ({
        ...prev,
        [docId]: {
          document_id: docId,
          status: 'processing',
          stage_progress: 10,
          current_stage: 'reindexing',
          attempt_count: 1,
        },
      }));
      showToast('success', 'Document processing restarted.');
      fetchDocuments();
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to restart processing.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await client.deleteDocument(deleteTarget.id);
    setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    showToast('success', `"${deleteTarget.title}" deleted.`);
    setDeleteTarget(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface text-on-surface">
      <div className="p-5 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-border-default/60 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
                Knowledge Documents
              </h1>
              {!isLoading && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20">
                  {documents.length}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-1">
              Ingest textbooks, lecture slides, and notes to power AI summaries, concepts, and spaced repetition.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setIsUploadModalOpen(true)}
            className="gap-2 shadow-neo self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Add Knowledge</span>
          </Button>
        </div>

        {/* Search, Filter & Sort Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-border-default bg-surface shadow-neo">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-lg border-2 border-border-default bg-surface-container focus:bg-surface focus:outline-hidden focus:border-primary transition-all"
            />
          </div>

          {/* Center: Status filter pills */}
          <div className="inline-flex rounded-lg border border-border-default bg-surface-container p-1 gap-1 self-start md:self-auto">
            {(['all', 'ready', 'processing', 'failed'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 rounded-md text-xs font-bold capitalize transition-all ${
                  statusFilter === filter
                    ? 'bg-primary text-on-primary shadow-neo-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Right: Sort dropdown */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <ArrowUpDown size={14} className="text-on-surface-variant shrink-0" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-xs font-bold rounded-lg border-2 border-border-default bg-surface-container py-1.5 px-2.5 focus:outline-hidden focus:border-primary cursor-pointer text-on-surface"
            >
              <option value="newest">Newest Added</option>
              <option value="oldest">Oldest Added</option>
              <option value="alpha">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <DocumentListSkeleton />
        ) : documents.length === 0 ? (
          /* Empty State: Brand New User */
          <div className="p-12 rounded-2xl border-2 border-dashed border-border-default bg-surface-container-low/40 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center shadow-neo">
              <Upload size={30} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-xl text-on-surface">
                Your Knowledge Base is Empty
              </h3>
              <p className="text-xs text-on-surface-variant font-medium max-w-sm leading-relaxed">
                Add your first PDF, text file, or Markdown document to start building knowledge you can actually remember.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-2 shadow-neo mt-2"
            >
              <Plus size={18} />
              <span>Add Your First Document</span>
            </Button>
          </div>
        ) : filteredAndSortedDocuments.length === 0 ? (
          /* Zero Search/Filter Results */
          <div className="p-10 rounded-xl border-2 border-border-default bg-surface text-center space-y-3 shadow-neo">
            <p className="font-black text-base text-on-surface">No documents match your filter</p>
            <p className="text-xs text-on-surface-variant">Try modifying or clearing your search term and filter selection.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          /* Documents Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                liveStatus={liveStatuses[doc.id]}
                onOpen={handleOpenDocument}
                onDeleteClick={(d) => setDeleteTarget(d)}
                onRetry={handleRetryProcessing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DocumentDeleteDialog
          isOpen={!!deleteTarget}
          documentTitle={deleteTarget.title}
          onClose={() => setDeleteTarget(null)}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
}
