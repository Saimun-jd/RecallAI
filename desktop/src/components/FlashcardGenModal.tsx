import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, type AtomicConcept } from '../api/client';
import type { RootState } from '../store';
import { setIsCardGenModalOpen, setActiveTopicCards } from '../store/readerSlice';
import { X, Loader2, Zap, CheckCircle2, Target } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import type { ApiError } from '../api/errors';

interface FlashcardGenModalProps {
  hasCachedMarkdown?: boolean;
  onSuccess?: (conceptName?: string) => void;
  atomicConcepts?: AtomicConcept[];
  activeTopicTitle?: string;
}

export function FlashcardGenModal({ 
  hasCachedMarkdown, 
  onSuccess,
  atomicConcepts = [],
  activeTopicTitle
}: FlashcardGenModalProps) {
  const dispatch = useDispatch();
  const { activeTopicId, isCardGenModalOpen } = useSelector((state: RootState) => state.reader);
  const { activeProvider, configuredProviders, pdfExtractor } = useSelector((state: RootState) => state.providers);
  
  const [count, setCount] = useState(3);
  const [cardType, setCardType] = useState('Conceptual');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [selectedConceptName, setSelectedConceptName] = useState<string>('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [providerOverride, setProviderOverride] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  if (!isCardGenModalOpen || activeTopicId === null) return null;

  const effectiveProvider = (providerOverride || activeProvider) as keyof typeof configuredProviders;
  const isKeyMissing = effectiveProvider !== 'ollama' && !configuredProviders[effectiveProvider];

  const handleGenerate = async () => {
    if (isKeyMissing) {
      showToast('error', `No API key configured for ${effectiveProvider.toUpperCase()}. Please configure your API key in Settings → API Keys.`);
      return;
    }

    setLoading(true);
    try {
      let customPrompt = `Generate flashcards of type: ${cardType}. Difficulty level: ${difficulty}.`;
      if (additionalPrompt.trim()) {
        customPrompt += `\nAdditional Instructions: ${additionalPrompt.trim()}`;
      }
      
      const options: any = { count, custom_prompt: customPrompt };
      options.provider_override = providerOverride || activeProvider;
      if (selectedConceptName) {
        options.concept_name = selectedConceptName;
      }
      
      await client.generateFlashcards(activeTopicId, options);
      
      // Fetch updated cards
      const newCards = await client.getTopicFlashcards(activeTopicId);
      dispatch(setActiveTopicCards(newCards));
      dispatch(setIsCardGenModalOpen(false));
      const targetMsg = selectedConceptName ? ` for "${selectedConceptName}"` : '';
      showToast('success', `Generated ${newCards.length} new flashcards${targetMsg}.`);
      if (onSuccess) {
        onSuccess(selectedConceptName || undefined);
      }
    } catch (err: any) {
      showToast('error', err?.userMessage || "Failed to generate flashcards", err?.debugDetail);
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
        
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          
          {/* Topic Scope / Target Concept */}
          {atomicConcepts && atomicConcepts.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-1.5">
                  <Target size={14} className="text-primary" />
                  <span>Topic Scope</span>
                </label>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  {atomicConcepts.length} atomic topics available
                </span>
              </div>
              <select 
                value={selectedConceptName}
                onChange={(e) => setSelectedConceptName(e.target.value)}
                className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg p-2.5 text-sm font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
              >
                <option value="">Whole Document / Topic {activeTopicTitle ? `(${activeTopicTitle})` : ''}</option>
                <optgroup label="Extracted Atomic Topics">
                  {atomicConcepts.map((concept) => (
                    <option key={concept.id || concept.name} value={concept.name}>
                      {concept.name} ({concept.concept_type || 'Concept'})
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Selected Concept Preview */}
              {(() => {
                const activeConcept = atomicConcepts.find(c => c.name === selectedConceptName);
                if (!activeConcept) return null;
                return (
                  <div className="p-3 bg-surface-container-low border border-on-surface/20 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">{activeConcept.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-surface rounded border border-on-surface/20 text-on-surface">
                        {activeConcept.concept_type}
                      </span>
                    </div>
                    {activeConcept.summary && (
                      <p className="text-on-surface-variant line-clamp-2 font-medium">{activeConcept.summary}</p>
                    )}
                    {activeConcept.key_terms && activeConcept.key_terms.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {activeConcept.key_terms.map(kt => (
                          <span key={kt} className="px-1.5 py-0.2 text-[10px] bg-surface rounded border border-on-surface/10 text-on-surface-variant font-mono">
                            {kt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="p-2.5 bg-surface-container-low border border-on-surface/15 rounded-lg text-xs flex items-center justify-between text-on-surface-variant">
              <span>Scope: <strong className="text-on-surface">{activeTopicTitle || 'Whole Document'}</strong></span>
              <span className="text-[10px] text-on-surface-variant/80 italic">Extract concepts to target atomic topics</span>
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
            {isKeyMissing && (
              <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-300 rounded p-2 mt-1 animate-in fade-in">
                ⚠️ No API key configured for {effectiveProvider.toUpperCase()}. Please configure your API key in Settings → API Keys.
              </p>
            )}
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
        <div className="px-5 py-4 border-t-2 border-on-surface bg-surface-container-low shrink-0 flex items-center justify-between gap-3 rounded-b-xl">
          <div className="flex-1">
            {hasCachedMarkdown ? (
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 italic">
                <CheckCircle2 size={12} /> Using cached markdown to generate
              </p>
            ) : (
              pdfExtractor === 'marker' && (
                <p className="text-xs font-medium text-amber-600 italic">
                  Marker (ML) is currently extracting text for this section. This may take a few minutes if models are downloading.
                </p>
              )
            )}
          </div>
          <div className="flex justify-end gap-3 shrink-0">
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
    </div>
  );
}

