import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client } from '../api/client';
import type { RootState } from '../store';
import { setIsCardGenModalOpen, setActiveTopicCards } from '../store/readerSlice';
import { X, Loader2, Zap, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../hooks/useToast';
import type { ApiError } from '../api/errors';

interface FlashcardGenModalProps {
  hasCachedMarkdown?: boolean;
  onSuccess?: () => void;
}

export function FlashcardGenModal({ hasCachedMarkdown, onSuccess }: FlashcardGenModalProps) {
  const dispatch = useDispatch();
  const { activeTopicId, isCardGenModalOpen } = useSelector((state: RootState) => state.reader);
  const { activeProvider, pdfExtractor } = useSelector((state: RootState) => state.providers);
  
  const [count, setCount] = useState(3);
  const [cardType, setCardType] = useState('Conceptual');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [providerOverride, setProviderOverride] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  if (!isCardGenModalOpen || activeTopicId === null) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let customPrompt = `Generate flashcards of type: ${cardType}. Difficulty level: ${difficulty}.`;
      if (additionalPrompt.trim()) {
        customPrompt += `\nAdditional Instructions: ${additionalPrompt.trim()}`;
      }
      
      const options: any = { count, custom_prompt: customPrompt };
      options.provider_override = providerOverride || activeProvider;
      
      await client.generateFlashcards(activeTopicId, options);
      
      // Fetch updated cards
      const newCards = await client.getTopicFlashcards(activeTopicId);
      dispatch(setActiveTopicCards(newCards));
      dispatch(setIsCardGenModalOpen(false));
      showToast('success', `Generated ${newCards.length} new flashcards.`);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      showToast('error', err?.userMessage || "Failed to generate flashcards", err?.debugDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-surface-container-lowest border border-border-default rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default bg-surface-container-low/60 shrink-0 rounded-t-2xl">
          <h2 className="font-semibold text-base flex items-center gap-2 text-on-surface">
            <Zap size={18} className="text-secondary" fill="currentColor" /> Generate Flashcards
          </h2>
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 hover:bg-surface-container rounded-md"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Number of Cards Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                Number of Cards
              </label>
              <span className="text-xs font-semibold text-on-surface bg-surface-container px-2 py-0.5 border border-border-default rounded-md">
                {count}
              </span>
            </div>
            <input 
              type="range" 
              min="1" max="10" 
              value={count} 
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-primary h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Card Type</label>
              <select 
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="w-full bg-surface-container-low border border-border-default rounded-lg p-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
              >
                <option>Conceptual</option>
                <option>Code/Implementation</option>
                <option>Mixed</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Difficulty</label>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-surface-container-low border border-border-default rounded-lg p-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Provider Override</label>
            <select 
              value={providerOverride}
              onChange={(e) => setProviderOverride(e.target.value)}
              className="w-full bg-surface-container-low border border-border-default rounded-lg p-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
            >
              <option value="">Default (Settings)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="groq">Groq (Llama-3)</option>
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
              Additional Instructions <span className="font-normal lowercase opacity-75">(optional)</span>
            </label>
            <textarea 
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="e.g. Focus specifically on matrix multiplication rules"
              className="w-full bg-surface-container-low border border-border-default rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none min-h-[60px] placeholder:text-on-surface-variant/50"
            />
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-border-default bg-surface-container-low/60 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <div className="flex-1">
            {hasCachedMarkdown ? (
              <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Using cached markdown to generate
              </p>
            ) : (
              pdfExtractor === 'marker' && (
                <p className="text-xs font-medium text-amber-600">
                  Marker (ML) is currently extracting text for this section.
                </p>
              )
            )}
          </div>
          <div className="flex justify-end gap-2.5 shrink-0">
            <button 
              onClick={() => dispatch(setIsCardGenModalOpen(false))}
              className="px-3.5 py-1.5 text-xs font-medium text-on-surface bg-surface-container-lowest border border-border-default rounded-lg hover:bg-surface-container shadow-2xs transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleGenerate}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold bg-primary text-on-primary rounded-lg flex items-center gap-1.5 shadow-xs hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} fill="currentColor" /> Generate</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

