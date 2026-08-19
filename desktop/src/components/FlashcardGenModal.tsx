import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client } from '../api/client';
import type { RootState } from '../store';
import { setIsCardGenModalOpen, setActiveTopicCards } from '../store/readerSlice';
import { X, Loader2, Zap } from 'lucide-react';

export function FlashcardGenModal() {
  const dispatch = useDispatch();
  const { activeTopicId, isCardGenModalOpen } = useSelector((state: RootState) => state.reader);
  
  const [count, setCount] = useState(3);
  const [cardType, setCardType] = useState('Conceptual');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [providerOverride, setProviderOverride] = useState('');
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
      if (providerOverride) {
        options.provider_override = providerOverride;
      }
      
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap size={18} className="text-emerald-500" /> Generate Flashcards
          </h2>
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-300">Number of Cards: {count}</label>
            <input 
              type="range" 
              min="1" max="10" 
              value={count} 
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-300">Card Type</label>
              <select 
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none"
              >
                <option>Conceptual</option>
                <option>Code/Implementation</option>
                <option>Mixed</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-300">Difficulty</label>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none"
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-300">Provider Override</label>
            <select 
              value={providerOverride}
              onChange={(e) => setProviderOverride(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="">Default (Settings)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="groq">Groq (Llama-3)</option>
            </select>
          </div>
          
          <div className="space-y-1 pt-2">
            <label className="text-sm font-medium text-zinc-300">Additional Instructions (Optional)</label>
            <textarea 
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="e.g. Focus specifically on matrix multiplication rules"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-20 placeholder:text-zinc-600"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-2">
          <button 
            onClick={() => dispatch(setIsCardGenModalOpen(false))}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-medium text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
