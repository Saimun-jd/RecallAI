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
      <div className="bg-surface-container-lowest border-[3px] border-on-background neo-shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-on-background bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm font-bold flex items-center gap-3 text-primary">
            <Zap size={20} className="text-secondary" fill="currentColor" /> Generate Flashcards
          </h2>
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="text-on-surface hover:text-error transition-colors p-1"
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {error && (
            <div className="text-label-md text-on-error bg-error p-3 border-[3px] border-on-background neo-shadow-sm font-bold">
              {error}
            </div>
          )}
          
          {/* Number of Cards Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
                Number of Cards
              </label>
              <span className="text-label-md font-bold text-on-surface bg-surface px-3 py-1 border-[3px] border-on-background neo-shadow-sm">
                {count}
              </span>
            </div>
            <input 
              type="range" 
              min="1" max="10" 
              value={count} 
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container border-[3px] border-on-background rounded-none appearance-none cursor-pointer"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Card Type</label>
              <select 
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="w-full bg-surface border-[3px] border-on-background p-3 text-label-md font-bold text-on-surface focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer appearance-none rounded-none"
              >
                <option>Conceptual</option>
                <option>Code/Implementation</option>
                <option>Mixed</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Difficulty</label>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-surface border-[3px] border-on-background p-3 text-label-md font-bold text-on-surface focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer appearance-none rounded-none"
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Provider Override</label>
            <select 
              value={providerOverride}
              onChange={(e) => setProviderOverride(e.target.value)}
              className="w-full bg-surface border-[3px] border-on-background p-3 text-label-md font-bold text-on-surface focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer appearance-none rounded-none"
            >
              <option value="">Default (Settings)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="groq">Groq (Llama-3)</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
              Additional Instructions <span className="font-normal lowercase opacity-75">(optional)</span>
            </label>
            <textarea 
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="e.g. Focus specifically on matrix multiplication rules"
              className="w-full bg-surface border-[3px] border-on-background p-3 text-label-md font-bold text-primary focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all resize-none min-h-[100px] placeholder:text-on-surface-variant/50 rounded-none"
            />
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="px-6 py-5 border-t-[3px] border-on-background bg-surface-container-low flex justify-end gap-4">
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="px-6 py-3 font-label-lg font-bold text-on-surface bg-surface border-[3px] border-on-background hover:bg-surface-container neo-shadow-sm active-neo-press transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 bg-primary text-on-primary font-label-lg font-bold border-[3px] border-on-background flex items-center gap-2 neo-shadow-sm active-neo-press transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <><Zap size={20} fill="currentColor" /> Generate Flashcards</>}
          </button>
        </div>

      </div>
    </div>
  );
}

