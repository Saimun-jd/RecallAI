import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client } from '../api/client';
import type { RootState } from '../store';
import { setIsCardGenModalOpen, setActiveTopicCards } from '../store/readerSlice';
import { X, Loader2, Zap } from 'lucide-react';
import clsx from 'clsx';

export function FlashcardGenModal() {
  const dispatch = useDispatch();
  const { activeTopicId, isCardGenModalOpen } = useSelector((state: RootState) => state.reader);
  const { activeProvider } = useSelector((state: RootState) => state.providers);
  
  const [count, setCount] = useState(3);
  const [cardType, setCardType] = useState('Conceptual');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [providerOverride, setProviderOverride] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCardGenModalOpen || activeTopicId === null) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
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
    } catch (err: any) {
      setError(err.message || "Failed to generate flashcards");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-surface border-2 border-on-surface rounded-xl shadow-[6px_6px_0px_0px_#191b23] w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-on-surface bg-surface-container-low shrink-0 rounded-t-xl">
          <h2 className="font-bold text-lg flex items-center gap-2 text-on-surface">
            <Zap size={20} className="text-secondary" fill="currentColor" /> Generate Flashcards
          </h2>
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="text-on-surface hover:text-error transition-colors p-1 hover:bg-surface-container rounded-md"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="text-sm text-on-error bg-error p-3 border-2 border-on-surface rounded-lg font-bold">
              {error}
            </div>
          )}
          
          {/* Number of Cards Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                Number of Cards
              </label>
              <span className="text-sm font-bold text-on-surface bg-surface-container-lowest px-2 py-0.5 border-2 border-on-surface rounded-md">
                {count}
              </span>
            </div>
            <input 
              type="range" 
              min="1" max="10" 
              value={count} 
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container-lowest border-2 border-on-surface rounded-full appearance-none cursor-pointer"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">Card Type</label>
              <select 
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg p-2.5 text-sm font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
              >
                <option>Conceptual</option>
                <option>Code/Implementation</option>
                <option>Mixed</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">Difficulty</label>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg p-2.5 text-sm font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">Provider Override</label>
            <select 
              value={providerOverride}
              onChange={(e) => setProviderOverride(e.target.value)}
              className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg p-2.5 text-sm font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
            >
              <option value="">Default (Settings)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="groq">Groq (Llama-3)</option>
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Additional Instructions <span className="font-normal lowercase opacity-75">(optional)</span>
            </label>
            <textarea 
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="e.g. Focus specifically on matrix multiplication rules"
              className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg p-2.5 text-sm font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all resize-none min-h-[60px] placeholder:text-on-surface-variant/50"
            />
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="px-5 py-4 border-t-2 border-on-surface bg-surface-container-low shrink-0 flex justify-end gap-3 rounded-b-xl">
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="px-4 py-2 text-sm font-bold text-on-surface bg-surface-container-lowest border-2 border-on-surface rounded-lg hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold bg-primary text-on-primary border-2 border-on-surface rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_0px_#191b23] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><Zap size={16} fill="currentColor" /> Generate</>}
          </button>
        </div>

      </div>
    </div>
  );
}

