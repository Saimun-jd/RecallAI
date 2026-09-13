import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, type AtomicConcept } from '../api/client';
import type { RootState } from '../store';
import { setActiveTopicCards } from '../store/readerSlice';
import { Zap, Target, Loader2, CheckCircle2, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../hooks/useToast';

interface FlashcardGenWidgetProps {
  topicId: number;
  topicTitle: string;
  hasCachedMarkdown?: boolean;
  atomicConcepts?: AtomicConcept[];
  selectedConceptName?: string;
  onSelectConceptName?: (name: string) => void;
  onSuccess?: (generatedConceptName?: string) => void;
}

export function FlashcardGenWidget({
  topicId,
  topicTitle,
  hasCachedMarkdown,
  atomicConcepts = [],
  selectedConceptName: controlledConceptName,
  onSelectConceptName,
  onSuccess,
}: FlashcardGenWidgetProps) {
  const dispatch = useDispatch();
  const { activeProvider, configuredProviders, pdfExtractor } = useSelector((state: RootState) => state.providers);
  const { showToast } = useToast();

  const [localConceptName, setLocalConceptName] = useState<string>('');
  const selectedConcept = controlledConceptName !== undefined ? controlledConceptName : localConceptName;

  const handleConceptChange = (name: string) => {
    if (controlledConceptName !== undefined && onSelectConceptName) {
      onSelectConceptName(name);
    } else {
      setLocalConceptName(name);
    }
  };

  const [count, setCount] = useState(3);
  const [cardType, setCardType] = useState('Conceptual');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeAtomicConcept = atomicConcepts.find(c => c.name === selectedConcept);

  const handleGenerate = async () => {
    if (activeProvider !== 'ollama' && !configuredProviders[activeProvider]) {
      showToast('error', `No API key configured for ${activeProvider.toUpperCase()}. Please configure your API key in Settings → API Keys.`);
      return;
    }

    setIsGenerating(true);
    try {
      let customPrompt = `Generate flashcards of type: ${cardType}. Difficulty level: ${difficulty}.`;
      if (additionalPrompt.trim()) {
        customPrompt += `\nAdditional Instructions: ${additionalPrompt.trim()}`;
      }

      const options: any = {
        count,
        custom_prompt: customPrompt,
        provider_override: activeProvider,
      };

      if (selectedConcept) {
        options.concept_name = selectedConcept;
      }

      await client.generateFlashcards(topicId, options);

      const newCards = await client.getTopicFlashcards(topicId);
      dispatch(setActiveTopicCards(newCards));

      const targetMsg = selectedConcept ? ` for "${selectedConcept}"` : '';
      showToast('success', `Generated ${newCards.length} flashcards${targetMsg}.`);

      if (onSuccess) {
        onSuccess(selectedConcept || undefined);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to generate flashcards.', err?.debugDetail);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Generating State ───────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className={clsx(
        "w-full border-2 rounded-xl shadow-[2px_2px_0px_0px_#191b23] p-8 flex flex-col items-center gap-4 relative overflow-hidden",
        selectedConcept ? "border-secondary/50 bg-secondary/5" : "border-outline-variant bg-surface-container-lowest"
      )}>
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider text-center">
          {selectedConcept
            ? `Analyzing and generating flashcards for "${selectedConcept}"…`
            : `Analyzing topic and generating flashcards for "${topicTitle}"…`}
        </p>

        {hasCachedMarkdown ? (
          <p className="font-body-sm text-body-sm text-emerald-600 font-bold italic mt-1 text-center max-w-sm flex items-center justify-center gap-1.5">
            <CheckCircle2 size={15} /> Using cached markdown to generate
          </p>
        ) : (
          pdfExtractor === 'marker' && (
            <p className="font-body-sm text-body-sm text-amber-600 font-medium italic mt-1 text-center max-w-sm">
              Marker (ML) is currently extracting text for this section.
            </p>
          )
        )}
      </div>
    );
  }

  // ─── Idle / Configuration State ─────────────────────────────────────
  return (
    <div className={clsx(
      "w-full border-2 rounded-xl shadow-[2px_2px_0px_0px_#191b23] p-4 flex flex-col gap-3 relative overflow-hidden group hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#191b23] transition-all duration-300",
      selectedConcept ? "border-secondary/50 bg-secondary/5" : "border-outline-variant bg-surface-container-lowest"
    )}>
      <div className={clsx(
        "absolute -right-12 -top-12 w-48 h-48 rounded-full blur-2xl transition-colors pointer-events-none",
        selectedConcept ? "bg-secondary/10 group-hover:bg-secondary/20" : "bg-primary/5 group-hover:bg-primary/10"
      )}></div>

      <div className="flex items-start justify-between z-10">
        <div className="flex flex-col gap-1 w-full">
          {/* Header Row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23]",
              selectedConcept ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary"
            )}>
              <Zap size={14} fill="currentColor" />
            </div>
            <h1 className="text-lg font-bold text-on-surface m-0 leading-none">
              {selectedConcept ? (
                <>Targeted Flashcards: <span className="text-secondary">{selectedConcept}</span></>
              ) : (
                "Flashcard Generator"
              )}
            </h1>
            {activeAtomicConcept && (
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/30">
                {activeAtomicConcept.concept_type}
              </span>
            )}
          </div>

          {/* Description */}
          {selectedConcept ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-on-surface-variant max-w-2xl mt-1">
                The AI will generate targeted retrieval flashcards probing <span className="font-bold text-on-surface bg-surface-variant px-1 rounded">{selectedConcept}</span> in {topicTitle}.
              </p>
              {activeAtomicConcept?.summary && (
                <p className="text-xs text-on-surface-variant/80 italic line-clamp-2 max-w-2xl">
                  "{activeAtomicConcept.summary}"
                </p>
              )}
              <button
                onClick={() => handleConceptChange('')}
                className="text-xs font-bold text-primary hover:underline self-start flex items-center gap-1 mt-1 transition-colors cursor-pointer"
              >
                <X size={12} /> Clear concept focus (generate for whole topic)
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-on-surface-variant max-w-2xl mt-1">
                The AI will extract key invariants, definitions, and questions about <span className="font-bold text-on-surface bg-surface-variant px-1 rounded">{topicTitle}</span> to test your recall and retention.
              </p>
              <p className="text-xs text-on-surface-variant/75 mt-1.5 flex items-center gap-1.5">
                <span className="font-semibold text-primary">Pro-tip:</span> To generate flashcards for an individual formula or definition, choose an atomic concept from the scope selector below.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Controls */}
      <div className="bg-surface-container-low/40 border border-outline-variant/60 rounded-xl p-3 flex flex-col gap-2.5 z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          {/* Target Scope */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <Target size={13} className="text-primary" />
              <span>Target Scope</span>
            </label>
            {atomicConcepts.length > 0 ? (
              <select
                value={selectedConcept}
                onChange={(e) => handleConceptChange(e.target.value)}
                className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer truncate"
              >
                <option value="">Whole Topic ({topicTitle})</option>
                <optgroup label="Extracted Atomic Concepts">
                  {atomicConcepts.map((concept) => (
                    <option key={concept.id || concept.name} value={concept.name}>
                      {concept.name} ({concept.concept_type || 'Concept'})
                    </option>
                  ))}
                </optgroup>
              </select>
            ) : (
              <div className="bg-surface-container-lowest border border-on-surface/30 rounded-lg px-2.5 py-1.5 text-xs font-medium text-on-surface-variant truncate">
                Whole Topic ({topicTitle})
              </div>
            )}
          </div>

          {/* Card Count */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Card Count
            </label>
            <div className="flex items-center gap-1">
              {[3, 5, 8, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={clsx(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg border-2 transition-all cursor-pointer",
                    count === num
                      ? "bg-primary text-on-primary border-on-surface shadow-[1.5px_1.5px_0px_0px_#191b23]"
                      : "bg-surface-container-lowest text-on-surface border-on-surface/20 hover:border-on-surface/60"
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Card Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Card Type
            </label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
            >
              <option>Conceptual</option>
              <option>Code/Implementation</option>
              <option>Key Definition</option>
              <option>Problem & Solution</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all cursor-pointer"
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
        </div>

        {/* Optional Custom Instructions toggle */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] font-bold text-on-surface-variant hover:text-primary flex items-center gap-1 self-start transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={12} />
            <span>{showAdvanced ? "Hide Custom Instructions" : "+ Add Custom Instructions / Focus"}</span>
            <ChevronDown size={12} className={clsx("transition-transform duration-200", showAdvanced && "rotate-180")} />
          </button>

          {showAdvanced && (
            <div className="mt-2 animate-in fade-in duration-150">
              <input
                type="text"
                placeholder="e.g. Focus on edge cases, mathematical formulas, or practical exam scenarios..."
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                className="w-full bg-surface-container-lowest border-2 border-on-surface rounded-lg p-2 text-xs font-medium text-on-surface focus:outline-none focus:shadow-[2px_2px_0px_0px_#191b23] transition-all"
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between mt-1 z-10">
        <button
          onClick={handleGenerate}
          className={clsx(
            "font-bold text-sm px-6 py-2.5 rounded-lg border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] flex items-center gap-2 active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all whitespace-nowrap cursor-pointer",
            selectedConcept ? "bg-secondary text-on-secondary hover:brightness-110" : "bg-primary text-on-primary hover:bg-academic-blue"
          )}
        >
          <Zap size={16} fill="currentColor" />
          <span>{selectedConcept ? `Generate "${selectedConcept}"` : 'Generate Flashcards'}</span>
        </button>
      </div>
    </div>
  );
}
