import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  AlertCircle,
  Loader2,
  Check,
  CheckSquare,
  Square,
  HelpCircle,
} from 'lucide-react';
import { Dialog, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  client,
  type DocumentItem,
  type QuizDetailResponse,
  type QuizGenerateRequest,
} from '../../api/client';

export interface QuizGenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newQuiz: QuizDetailResponse) => void;
  preselectedDocumentId?: string | null;
}

export function QuizGenerateDialog({
  isOpen,
  onClose,
  onSuccess,
  preselectedDocumentId,
}: QuizGenerateDialogProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionTypes, setQuestionTypes] = useState<string[]>(['multiple_choice', 'true_false']);
  const [provider, setProvider] = useState<string>('auto');

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load documents when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingDocs(true);
    setError(null);

    client
      .getDocuments(50, 0, 'ready')
      .then((resp) => {
        if (!isMounted) return;
        setDocuments(resp.documents || []);
        if (preselectedDocumentId) {
          setSelectedDocIds([preselectedDocumentId]);
        } else if (resp.documents && resp.documents.length > 0 && selectedDocIds.length === 0) {
          setSelectedDocIds([resp.documents[0].id]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load documents for quiz generation:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingDocs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, preselectedDocumentId]);

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const toggleType = (t: string) => {
    setQuestionTypes((prev) => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((item) => item !== t);
      }
      return [...prev, t];
    });
  };

  const handleGenerate = async () => {
    if (selectedDocIds.length === 0) {
      setError('Please select at least one study document.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const payload: QuizGenerateRequest = {
        document_ids: selectedDocIds,
        title: title.trim() || undefined,
        topic: topic.trim() || undefined,
        question_count: questionCount,
        question_types: questionTypes,
        difficulty,
        provider: provider === 'auto' ? undefined : provider,
      };

      const result = await client.generateQuiz(payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(
        err?.userMessage || err?.detail || 'Failed to generate quiz. Please try again.'
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!generating) onClose();
      }}
      title="Generate AI Assessment Quiz"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-error/10 border-2 border-error/30 text-error flex items-start gap-2.5 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold">Generation Issue</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Document Selection */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant flex items-center justify-between">
            <span>Source Documents</span>
            <span className="text-[10px] font-bold text-primary lowercase">
              {selectedDocIds.length} selected
            </span>
          </label>

          {loadingDocs ? (
            <div className="h-28 rounded-xl border-2 border-border-default bg-surface-container-low/50 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : documents.length === 0 ? (
            <div className="p-4 rounded-xl border-2 border-dashed border-border-default bg-surface-container-low/30 text-center text-xs text-on-surface-variant">
              No ready documents available. Upload documents first to generate quizzes.
            </div>
          ) : (
            <div className="max-h-36 overflow-y-auto border-2 border-border-default rounded-xl divide-y divide-border-default/50 bg-surface">
              {documents.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleDoc(doc.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 font-bold text-primary'
                        : 'hover:bg-surface-container text-on-surface'
                    }`}
                  >
                    <div className="shrink-0">
                      {isSelected ? (
                        <CheckSquare size={15} className="text-primary" />
                      ) : (
                        <Square size={15} className="text-on-surface-variant/50" />
                      )}
                    </div>
                    <FileText size={13} className="shrink-0 opacity-60" />
                    <span className="truncate flex-1">{doc.title}</span>
                    <span className="text-[10px] text-on-surface-variant shrink-0">
                      {doc.total_pages}p
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Title (Optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
            Quiz Title (Optional)
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Cognitive Psychology Midterm Review"
            disabled={generating}
          />
        </div>

        {/* Topic Focus Area (Optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
            Conceptual Focus (Optional)
          </label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Long-term potentiation and synaptic plasticity"
            disabled={generating}
          />
        </div>

        {/* Question Count & Difficulty Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Question Count */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
                Questions
              </label>
              <span className="text-xs font-black text-primary tabular-nums">
                {questionCount}
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="30"
              step="1"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
              disabled={generating}
              className="w-full accent-primary cursor-pointer h-2 bg-surface-container-high rounded-lg appearance-none"
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
              Difficulty
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['easy', 'medium', 'hard'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  disabled={generating}
                  className={`py-1.5 rounded-lg border-2 text-[11px] font-black capitalize transition-all cursor-pointer ${
                    difficulty === diff
                      ? 'bg-amber-500 text-white border-amber-600 shadow-neo-sm'
                      : 'border-border-default hover:bg-surface-container text-on-surface'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question Types */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
            Question Formats
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'multiple_choice', label: 'Multiple Choice' },
              { id: 'true_false', label: 'True / False' },
            ].map((fmt) => {
              const checked = questionTypes.includes(fmt.id);
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => toggleType(fmt.id)}
                  disabled={generating}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer text-left ${
                    checked
                      ? 'border-primary/40 bg-primary/10 text-primary shadow-neo-sm'
                      : 'border-border-default hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <div className="w-4 h-4 rounded border flex items-center justify-center border-primary shrink-0">
                    {checked && <Check size={12} className="text-primary" />}
                  </div>
                  <span>{fmt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={generating}
            className="w-full text-xs font-bold text-on-surface bg-surface border-2 border-border-default rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="auto">Auto (Default Recommended)</option>
            <option value="gemini">Google Gemini</option>
            <option value="groq">Groq (Ultra Fast)</option>
            <option value="openai">OpenAI GPT</option>
            <option value="ollama">Ollama (Local Private)</option>
          </select>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          size="md"
          onClick={onClose}
          disabled={generating}
        >
          Cancel
        </Button>
        <Button
          variant="ai"
          size="md"
          onClick={handleGenerate}
          isLoading={generating}
          className="gap-2"
        >
          <Sparkles size={16} />
          <span>{generating ? 'Generating Questions...' : 'Generate Assessment'}</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
