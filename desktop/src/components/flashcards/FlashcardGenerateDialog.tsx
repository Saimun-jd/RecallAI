import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, BookOpen } from 'lucide-react';
import { Dialog, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { client, type DocumentItem, type FlashcardSetDetailResponse } from '../../api/client';

export interface FlashcardGenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (set: FlashcardSetDetailResponse) => void;
  preselectedDocumentId?: string | null;
}

type GenerateState = 'idle' | 'generating' | 'success' | 'error';

export function FlashcardGenerateDialog({
  isOpen,
  onClose,
  onSuccess,
  preselectedDocumentId,
}: FlashcardGenerateDialogProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(
    preselectedDocumentId ? [preselectedDocumentId] : []
  );
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);

  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedSet, setGeneratedSet] = useState<FlashcardSetDetailResponse | null>(null);

  // Fetch documents for the selector
  useEffect(() => {
    if (!isOpen) return;
    const fetchDocs = async () => {
      setLoadingDocs(true);
      try {
        const resp = await client.getDocuments(50, 0);
        setDocuments(resp.documents.filter((d) => d.status === 'ready'));
      } catch {
        setDocuments([]);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [isOpen]);

  // Sync preselected doc when dialog opens
  useEffect(() => {
    if (isOpen && preselectedDocumentId) {
      setSelectedDocIds([preselectedDocumentId]);
    }
  }, [isOpen, preselectedDocumentId]);

  const handleReset = () => {
    setGenerateState('idle');
    setErrorMessage(null);
    setGeneratedSet(null);
    setTitle('');
    setTopic('');
    setCount(10);
    if (!preselectedDocumentId) setSelectedDocIds([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleGenerate = async () => {
    setGenerateState('generating');
    setErrorMessage(null);

    try {
      const result = await client.generateFlashcards({
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        title: title.trim() || null,
        topic: topic.trim() || null,
        count,
      });
      setGeneratedSet(result);
      setGenerateState('success');
      onSuccess(result);
    } catch (err: any) {
      const msg =
        err?.userMessage ||
        err?.message ||
        (err?.statusCode === 429
          ? 'Generation rate limit exceeded. Please wait before trying again.'
          : 'Failed to generate flashcards.');
      setErrorMessage(msg);
      setGenerateState('error');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          Generate Flashcards
        </span>
      }
      description="Create a study set from your documents using AI"
      maxWidth="lg"
    >
      {generateState === 'idle' && (
        <div className="space-y-5">
          {/* Document Selector */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
              Source Documents
            </label>
            {loadingDocs ? (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant py-3">
                <Loader2 size={14} className="animate-spin" /> Loading documents…
              </div>
            ) : documents.length === 0 ? (
              <p className="text-xs text-on-surface-variant p-3 rounded-lg border border-border-default bg-surface-container-low">
                No ready documents found. Upload a document first.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto border-2 border-border-default rounded-xl divide-y divide-border-default/60">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDocSelection(doc.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-primary border-primary' : 'border-border-default'
                        }`}
                      >
                        {isSelected && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <BookOpen size={12} className="shrink-0 opacity-50" />
                      <span className="truncate">{doc.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-on-surface-variant">
              {selectedDocIds.length === 0
                ? 'Leave empty to generate from all workspace knowledge'
                : `${selectedDocIds.length} document${selectedDocIds.length > 1 ? 's' : ''} selected`}
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="fc-title" className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
              Set Title <span className="text-on-surface-variant font-medium normal-case">(optional)</span>
            </label>
            <Input
              id="fc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cell Biology Key Concepts"
              maxLength={150}
            />
          </div>

          {/* Topic focus */}
          <div className="space-y-1.5">
            <label htmlFor="fc-topic" className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
              Focus Topic <span className="text-on-surface-variant font-medium normal-case">(optional)</span>
            </label>
            <Input
              id="fc-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. mitochondria, photosynthesis"
              maxLength={200}
            />
          </div>

          {/* Card Count */}
          <div className="space-y-1.5">
            <label htmlFor="fc-count" className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
              Number of Cards
            </label>
            <div className="flex items-center gap-3">
              <input
                id="fc-count"
                type="range"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10))}
                className="flex-1 h-2 accent-primary cursor-pointer"
              />
              <span className="text-sm font-black text-on-surface w-8 text-right tabular-nums">{count}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="ai" onClick={handleGenerate} disabled={documents.length === 0}>
              <Sparkles size={14} />
              Generate {count} Cards
            </Button>
          </DialogFooter>
        </div>
      )}

      {generateState === 'generating' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center shadow-neo-sm">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="font-black text-base text-on-surface">Generating flashcards…</p>
            <p className="text-xs text-on-surface-variant font-medium">
              AI is creating {count} study cards grounded in your documents
            </p>
          </div>
        </div>
      )}

      {generateState === 'success' && generatedSet && (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 border-2 border-emerald-500/20 flex items-center justify-center shadow-neo-sm">
            <CheckCircle2 size={24} />
          </div>
          <div className="space-y-1">
            <p className="font-black text-base text-on-surface">
              {generatedSet.card_count} cards created!
            </p>
            <p className="text-xs text-on-surface-variant font-medium">
              "{generatedSet.title}" is ready to study
            </p>
          </div>
          <DialogFooter className="w-full justify-center">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                handleClose();
              }}
            >
              View Set
            </Button>
          </DialogFooter>
        </div>
      )}

      {generateState === 'error' && (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-error/10 text-error border-2 border-error/20 flex items-center justify-center shadow-neo-sm">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="font-black text-base text-on-surface">Generation Failed</p>
            <p className="text-xs text-on-surface-variant font-medium">{errorMessage}</p>
          </div>
          <DialogFooter className="w-full justify-center">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => setGenerateState('idle')}>
              Try Again
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  );
}
