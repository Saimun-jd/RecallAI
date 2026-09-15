import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, AlertCircle, 
  Trash2, MessageSquare, BrainCircuit, 
  CheckCircle2, BookOpen, Sparkles, Layers, FileText 
} from 'lucide-react';
import { 
  client, 
  type DocumentItem, 
  type DocumentSummaryResponse, 
  type ConceptItemResponse, 
  type ChunkItemResponse, 
  type RelatedDocumentItem 
} from '../api/client';
import { useToast } from '../hooks/useToast';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { 
  DocumentOverviewTab, 
  DocumentSummaryTab, 
  DocumentConceptsTab, 
  DocumentSourcesTab, 
  DocumentStudyTab,
  DocumentDeleteDialog 
} from '../components/documents';
import { BookDetailView } from './BookDetailView';

export function DocumentDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Backward compatibility check for legacy numeric book IDs
  const isNumericId = id && !isNaN(Number(id)) && !id.includes('-');

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [summary, setSummary] = useState<DocumentSummaryResponse | null>(null);
  const [concepts, setConcepts] = useState<ConceptItemResponse[]>([]);
  const [chunks, setChunks] = useState<ChunkItemResponse[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocumentItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Sub-feature generation states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isExtractingConcepts, setIsExtractingConcepts] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch document and its associated knowledge layers
  const fetchAllData = useCallback(async (docId: string) => {
    setIsLoading(true);
    setNotFound(false);
    setErrorMessage(null);

    try {
      // 1. Fetch primary document record
      let docRecord: DocumentItem;
      try {
        docRecord = await client.getDocument(docId);
        setDocument(docRecord);
        if (docRecord.metadata?.book_id) {
          navigate(`/books/${docRecord.metadata.book_id}`, { replace: true });
          return;
        }
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 403) {
          setNotFound(true);
          return;
        }
        throw err;
      }

      // 2. Resilient parallel fetch for secondary knowledge layers
      const [summaryRes, conceptsRes, chunksRes, relatedRes] = await Promise.allSettled([
        client.getDocumentSummary(docId, 'standard'),
        client.getDocumentConcepts(docId),
        client.getDocumentChunks(docId, 50, 0),
        client.getRelatedDocuments(docId, 5),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      } else {
        setSummary(null);
      }

      if (conceptsRes.status === 'fulfilled' && conceptsRes.value?.concepts) {
        setConcepts(conceptsRes.value.concepts);
      } else {
        setConcepts([]);
      }

      if (chunksRes.status === 'fulfilled' && chunksRes.value?.chunks) {
        setChunks(chunksRes.value.chunks);
        setTotalChunks(chunksRes.value.total);
      } else {
        setChunks([]);
        setTotalChunks(0);
      }

      if (relatedRes.status === 'fulfilled' && relatedRes.value?.related_documents) {
        setRelatedDocs(relatedRes.value.related_documents);
      } else {
        setRelatedDocs([]);
      }
    } catch (err: any) {
      console.error('Failed to load document details:', err);
      setErrorMessage(err?.userMessage || 'Failed to load document information.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id && !isNumericId) {
      fetchAllData(id);
    }
  }, [id, isNumericId, fetchAllData]);

  // If a legacy numeric ID was passed, render the legacy BookDetailView
  if (isNumericId) {
    return <BookDetailView />;
  }

  // Summary generation handler
  const handleGenerateSummary = async (type: 'short' | 'standard' | 'detailed', force: boolean = false) => {
    if (!id) return;
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      showToast('info', `Generating ${type} summary with AI...`);
      const res = await client.generateDocumentSummary(id, type, force);
      setSummary(res);
      showToast('success', 'Summary generated successfully!');
    } catch (err: any) {
      const msg = err?.userMessage || 'Failed to generate summary. Check AI credits or connectivity.';
      setSummaryError(msg);
      showToast('error', msg);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Concept extraction handler
  const handleExtractConcepts = async (force: boolean = false) => {
    if (!id) return;
    setIsExtractingConcepts(true);
    setConceptsError(null);
    try {
      showToast('info', 'Extracting high-yield concepts with AI...');
      const res = await client.generateDocumentConcepts(id, 12, force);
      setConcepts(res.concepts || []);
      showToast('success', 'Concepts extracted successfully!');
    } catch (err: any) {
      const msg = err?.userMessage || 'Failed to extract concepts.';
      setConceptsError(msg);
      showToast('error', msg);
    } finally {
      setIsExtractingConcepts(false);
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!id) return;
    const bookId = document?.metadata?.book_id || (!isNaN(Number(id)) && !id.includes('-') ? Number(id) : null);

    if (bookId) {
      try {
        await client.deleteBook(bookId);
      } catch (e) {
        console.warn('client.deleteBook failed or already removed:', e);
      }
    }

    try {
      await client.deleteDocument(id);
    } catch (err: any) {
      const isNotFound =
        err?.errorCode === 'NOT_FOUND' ||
        err?.httpStatus === 404 ||
        err?.status === 404 ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('not found')) ||
        (typeof err?.userMessage === 'string' && err.userMessage.toLowerCase().includes('not found'));

      if (!isNotFound && !bookId) {
        throw err;
      }
      console.warn('Document was already not found in database, proceeding with navigation:', err);
    }

    showToast('success', 'Document deleted.');
    navigate('/documents');
  };

  // Not Found State
  if (notFound) {
    return (
      <div className="flex-1 overflow-y-auto bg-surface text-on-surface p-8">
        <div className="max-w-md mx-auto my-16 p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-error/10 border-2 border-error/20 text-error flex items-center justify-center mx-auto shadow-neo-sm">
            <AlertCircle size={26} />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-xl text-on-surface">Document Not Found</h3>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              This document may have been deleted, or you may not have permission to view it.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/documents')}
            className="w-full justify-center gap-2 mt-2"
          >
            <ArrowLeft size={16} />
            <span>Back to Documents</span>
          </Button>
        </div>
      </div>
    );
  }

  // Loading Skeleton State
  if (isLoading || !document) {
    return (
      <div className="flex-1 overflow-y-auto bg-surface text-on-surface p-6 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-4 w-40 bg-surface-container-high rounded" />
          <div className="p-6 rounded-2xl border-2 border-border-default/60 bg-surface shadow-neo space-y-4">
            <div className="h-7 w-2/3 bg-surface-container-high rounded" />
            <div className="flex gap-3">
              <div className="h-5 w-16 bg-surface-container rounded" />
              <div className="h-5 w-20 bg-surface-container rounded" />
              <div className="h-5 w-24 bg-surface-container rounded" />
            </div>
          </div>
          <div className="h-10 w-80 bg-surface-container rounded-xl" />
          <div className="p-8 rounded-2xl border-2 border-border-default/60 bg-surface shadow-neo h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface text-on-surface">
      <div className="p-5 sm:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs
          items={[
            { label: 'Documents', href: '/documents' },
            { label: document.title },
          ]}
        />

        {/* Document Header Card */}
        <div className="p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-primary/10 text-primary border-primary/20">
                  {document.source_type.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-100/90 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 size={12} />
                  Ready
                </span>
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(document.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight leading-tight">
                {document.title}
              </h1>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
              {(document.metadata?.book_id || document.source_type === 'pdf') && (
                <Button
                  variant="primary"
                  onClick={() => navigate(`/books/${document.metadata?.book_id || document.id}`)}
                  className="gap-1.5 shadow-neo-sm text-xs h-9 bg-primary text-white"
                >
                  <BookOpen size={14} />
                  <span>Open in Reader</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => navigate(`/review?document_id=${document.id}`)}
                className="gap-1.5 text-xs h-9"
              >
                <BrainCircuit size={14} />
                <span>Study</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate(`/notes?document_id=${document.id}`)}
                className="gap-1.5 text-xs h-9"
              >
                <MessageSquare size={14} />
                <span>Ask Document</span>
              </Button>

              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className="p-2 rounded-lg border border-border-default text-on-surface-variant hover:text-error hover:bg-error/10 hover:border-error/30 transition-all"
                title="Delete document"
                aria-label="Delete document"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto pb-1 hide-scrollbar">
            <TabsList className="bg-surface border-2 border-border-default p-1 shadow-neo-sm">
              <TabsTrigger value="overview" className="text-xs font-black gap-1.5">
                <BookOpen size={14} />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="summary" className="text-xs font-black gap-1.5">
                <Sparkles size={14} />
                <span>Summary</span>
              </TabsTrigger>
              <TabsTrigger value="concepts" className="text-xs font-black gap-1.5">
                <Layers size={14} />
                <span>Concepts ({concepts.length})</span>
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs font-black gap-1.5">
                <FileText size={14} />
                <span>Sources ({totalChunks || chunks.length})</span>
              </TabsTrigger>
              <TabsTrigger value="study" className="text-xs font-black gap-1.5">
                <BrainCircuit size={14} />
                <span>Study & Ask</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="pt-4">
            <TabsContent value="overview">
              <DocumentOverviewTab
                document={document}
                relatedDocuments={relatedDocs}
                onNavigateRelated={(relId) => navigate(`/documents/${relId}`)}
                onSelectTab={setActiveTab}
              />
            </TabsContent>

            <TabsContent value="summary">
              <DocumentSummaryTab
                documentId={document.id}
                summary={summary}
                isLoading={false}
                isGenerating={isGeneratingSummary}
                error={summaryError}
                onGenerate={handleGenerateSummary}
              />
            </TabsContent>

            <TabsContent value="concepts">
              <DocumentConceptsTab
                documentId={document.id}
                concepts={concepts}
                isLoading={false}
                isExtracting={isExtractingConcepts}
                error={conceptsError}
                onExtract={handleExtractConcepts}
              />
            </TabsContent>

            <TabsContent value="sources">
              <DocumentSourcesTab
                documentId={document.id}
                chunks={chunks}
                totalChunks={totalChunks}
                isLoading={false}
                error={null}
              />
            </TabsContent>

            <TabsContent value="study">
              <DocumentStudyTab document={document} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <DocumentDeleteDialog
        isOpen={isDeleteOpen}
        documentTitle={document.title}
        onClose={() => setIsDeleteOpen(false)}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
}
