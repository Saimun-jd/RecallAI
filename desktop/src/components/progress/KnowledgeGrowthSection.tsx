import React, { useState } from 'react';
import { Book, FileText, ArrowRight, Layers, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  type DocumentLearningProgress, 
  type ConceptLearningProgress 
} from '../../api/client';
import { cn } from '../../lib/utils';

interface KnowledgeGrowthSectionProps {
  documentsProgress: DocumentLearningProgress[];
  conceptsProgress?: ConceptLearningProgress[];
}

export const KnowledgeGrowthSection: React.FC<KnowledgeGrowthSectionProps> = ({
  documentsProgress,
  conceptsProgress = [],
}) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'concepts'>('documents');
  const hasDocuments = documentsProgress.length > 0;
  const hasConcepts = conceptsProgress.length > 0;

  return (
    <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-border-default mb-5">
        <div className="flex items-center gap-2">
          <Book size={18} strokeWidth={2.5} className="text-primary" />
          <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
            Knowledge Growth & Document Progress
          </h3>
        </div>

        {hasConcepts && (
          <div className="flex items-center bg-surface-container border border-border-default rounded-lg p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={cn(
                "px-3 py-1 text-xs font-black rounded-md transition-all",
                activeTab === 'documents'
                  ? "bg-primary text-on-primary shadow-neo-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              Documents ({documentsProgress.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('concepts')}
              className={cn(
                "px-3 py-1 text-xs font-black rounded-md transition-all",
                activeTab === 'concepts'
                  ? "bg-primary text-on-primary shadow-neo-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              Key Concepts ({conceptsProgress.length})
            </button>
          </div>
        )}
      </div>

      {!hasDocuments ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-surface-container border-2 border-border-default flex items-center justify-center mx-auto mb-3 text-on-surface-variant shadow-neo-sm">
            <FileText size={22} />
          </div>
          <h4 className="text-sm font-black text-on-surface mb-1">
            No Document Learning Progress Recorded
          </h4>
          <p className="text-xs font-semibold text-on-surface-variant mb-4">
            Upload course materials or study guides to track per-source retention.
          </p>
          <Link
            to="/documents"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-black uppercase tracking-wide border-2 border-border-default rounded-xl shadow-neo hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Upload Documents <ArrowRight size={14} />
          </Link>
        </div>
      ) : activeTab === 'documents' ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b-2 border-border-default bg-surface-container/60 text-on-surface font-black uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Document Title</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Mastery Progress</th>
                  <th className="py-2.5 px-3">Retention</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default font-medium text-on-surface">
                {documentsProgress.map((doc) => {
                  const total = doc.total_learning_items > 0 ? doc.total_learning_items : 1;
                  const pctMastered = Math.round((doc.review_items / total) * 100);
                  const isDue = doc.due_items > 0;

                  return (
                    <tr key={doc.document_id} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface truncate max-w-[220px] sm:max-w-xs" title={doc.title}>
                          {doc.title}
                        </div>
                        {isDue && (
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                            {doc.due_items} cards due for review
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        {doc.total_learning_items}
                      </td>
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-surface-container rounded-full overflow-hidden border border-border-default/60">
                            <div 
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${pctMastered}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-on-surface shrink-0">
                            {pctMastered}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md font-bold text-[11px] border",
                          doc.correct_rate >= 80 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : doc.correct_rate >= 60
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-surface-container text-on-surface-variant border-border-default"
                        )}>
                          {doc.total_learning_items > 0 ? `${doc.correct_rate}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/documents/${doc.document_id}`}
                          className="inline-flex items-center gap-1 text-primary font-black hover:underline"
                        >
                          View <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Concepts Tab */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {conceptsProgress.map((c) => {
            const total = c.total_learning_items > 0 ? c.total_learning_items : 1;
            const pctMastered = Math.round((c.review_items / total) * 100);

            return (
              <div key={c.concept} className="p-3.5 rounded-xl border border-border-default bg-surface-container/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-black text-on-surface truncate" title={c.concept}>
                      {c.concept}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-primary shrink-0">
                      {c.total_learning_items} items
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden border border-border-default/60 my-2">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pctMastered}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium mt-1">
                  <span>{pctMastered}% Mastered</span>
                  <span className="font-bold text-on-surface">{c.correct_rate}% retention</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
