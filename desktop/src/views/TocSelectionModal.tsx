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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Select Chapters</h2>
              <p className="text-sm text-zinc-400 mt-0.5">Choose which sections to extract flashcards from.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
            <input 
              type="checkbox" 
              checked={selectedIndices.size === toc.length && toc.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
            />
            {selectedIndices.size === toc.length ? 'Deselect All' : 'Select All'}
          </label>
          <span className="text-sm text-emerald-500/80 font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            {selectedIndices.size} selected
          </span>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3">
          {toc.length === 0 ? (
            <div className="text-center p-8 text-zinc-500">No chapters found.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {toc.map((entry, idx) => {
                const isSelected = selectedIndices.has(idx);
                return (
                  <label 
                    key={idx} 
                    className={clsx(
                      "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors border border-transparent",
                      isSelected ? "bg-emerald-500/5 border-emerald-500/20" : "hover:bg-zinc-800 hover:border-zinc-700/50"
                    )}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelection(idx)}
                      className="mt-1 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
                    />
                    <div className="flex-1" style={{ paddingLeft: `${(entry.level - 1) * 1.25}rem` }}>
                      <p className={clsx("text-sm", entry.level === 1 ? 'font-semibold text-zinc-200' : 'text-zinc-400')}>
                        {entry.title}
                      </p>
                    </div>
                    <div className="text-xs text-zinc-500 font-medium whitespace-nowrap bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                      p. {entry.start_page}-{entry.end_page}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Pages to process: <span className="font-bold text-zinc-200">{totalPages}</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleProcess}
              disabled={selectedIndices.size === 0}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50 disabled:shadow-none"
            >
              Process Selected
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
