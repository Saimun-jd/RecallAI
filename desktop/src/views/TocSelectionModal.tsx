import { useState, useEffect } from 'react';
import type { TocEntry, SectionSelection } from '../api/client';
import { X, Layers } from 'lucide-react';
import clsx from 'clsx';

interface TocSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  toc: TocEntry[];
  onProcess: (sections: SectionSelection[]) => void;
}

export function TocSelectionModal({ isOpen, onClose, toc, onProcess }: TocSelectionModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Select all by default
    if (isOpen) {
      setSelectedIndices(new Set(toc.map((_, i) => i)));
    }
  }, [isOpen, toc]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIndices.size === toc.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(toc.map((_, i) => i)));
    }
  };

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const handleProcess = () => {
    const selectedSections = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map(i => ({
        title: toc[i].title,
        start_page: toc[i].start_page,
        end_page: toc[i].end_page
      }));
    onProcess(selectedSections);
  };

  const totalPages = Array.from(selectedIndices).reduce((sum, i) => {
    const entry = toc[i];
    return sum + (entry.end_page - entry.start_page + 1);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] shadow-[var(--shadow-lg)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-default flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[var(--radius-standard)] bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/20">
              <Layers size={20} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary tracking-tight">Select Chapters</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Choose which sections to extract flashcards from.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-[var(--radius-standard)] transition-all duration-200">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-border-default/50 flex items-center justify-between bg-surface-container-low">
          <label className="flex items-center gap-2 text-sm font-medium text-on-surface cursor-pointer hover:text-primary transition-colors duration-200">
            <input 
              type="checkbox" 
              checked={selectedIndices.size === toc.length && toc.length > 0}
              onChange={toggleSelectAll}
              className="rounded-[var(--radius-tag)] border-outline-variant bg-surface-container-lowest text-accent-blue focus:ring-accent-blue/20 w-4 h-4"
            />
            {selectedIndices.size === toc.length ? 'Deselect All' : 'Select All'}
          </label>
          <span className="text-sm text-accent-blue font-medium px-2.5 py-1 rounded-[var(--radius-tag)] bg-accent-blue/10 border border-accent-blue/20">
            {selectedIndices.size} selected
          </span>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3">
          {toc.length === 0 ? (
            <div className="text-center p-8 text-on-surface-variant">No chapters found.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {toc.map((entry, idx) => {
                const isSelected = selectedIndices.has(idx);
                return (
                  <label 
                    key={idx} 
                    className={clsx(
                      "flex items-start gap-3 p-3 rounded-[var(--radius-standard)] cursor-pointer transition-all duration-200 border border-transparent",
                      isSelected ? "bg-accent-blue/5 border-accent-blue/20" : "hover:bg-surface-container hover:border-border-default"
                    )}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelection(idx)}
                      className="mt-1 rounded-[var(--radius-tag)] border-outline-variant bg-surface-container-lowest text-accent-blue focus:ring-accent-blue/20 w-4 h-4"
                    />
                    <div className="flex-1" style={{ paddingLeft: `${(entry.level - 1) * 1.25}rem` }}>
                      <p className={clsx("text-sm", entry.level === 1 ? 'font-semibold text-primary' : 'text-on-surface-variant')}>
                        {entry.title}
                      </p>
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium whitespace-nowrap bg-surface-container px-2 py-1 rounded-[var(--radius-tag)] border border-border-default">
                      p. {entry.start_page}-{entry.end_page}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border-default bg-surface-container-low flex items-center justify-between">
          <div className="text-sm text-on-surface-variant">
            Pages to process: <span className="font-bold text-primary">{totalPages}</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-[var(--radius-standard)] transition-all duration-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleProcess}
              disabled={selectedIndices.size === 0}
              className="px-6 py-2.5 bg-accent-blue hover:bg-secondary-container text-white text-sm font-semibold rounded-[var(--radius-standard)] shadow-[var(--shadow-sm)] transition-all duration-200 disabled:opacity-50"
            >
              Process Selected
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
