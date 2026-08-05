import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, type RelatedTopic } from '../api/client';
import type { RootState } from '../store';
import { setActiveTopicId } from '../store/readerSlice';
import { X, Loader2, Link2 } from 'lucide-react';

interface RelatedTopicsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RelatedTopicsModal({ isOpen, onClose }: RelatedTopicsModalProps) {
  const dispatch = useDispatch();
  const { activeTopicId } = useSelector((state: RootState) => state.reader);
  
  const [topics, setTopics] = useState<RelatedTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTopicId) {
      let active = true;
      setLoading(true);
      setError(null);
      client.getRelatedTopics(activeTopicId)
        .then(data => {
          if (active) setTopics(data);
        })
        .catch(err => {
          if (active) setError(err.message || "Failed to load related topics");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }
  }, [isOpen, activeTopicId]);

  if (!isOpen) return null;

  const handleTopicClick = (id: number) => {
    dispatch(setActiveTopicId(id));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 size={18} className="text-emerald-500" /> Related Topics
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm bg-red-500/10 p-4 rounded">{error}</div>
          ) : topics.length === 0 ? (
            <div className="text-zinc-400 text-center py-8">No related topics found.</div>
          ) : (
            <div className="space-y-3">
              {topics.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTopicClick(t.id)}
                  className="w-full text-left bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 p-4 rounded-lg transition-colors group flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{t.breadcrumb}</div>
                    </div>
                    <div className="shrink-0 px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-mono rounded">
                      {(t.similarity * 100).toFixed(1)}% match
                    </div>
                  </div>
                  {t.summary && (
                    <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {t.summary}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
