import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { GraduationCap, BookOpen, Brain, Layers, Check, Filter } from 'lucide-react';
import { setActiveTopicId, setTargetPage, setExamScopeTopicIds } from '../store/readerSlice';
import type { RootState } from '../store';
import type { ExamTopicItem } from '../api/client';
import { cn } from '../lib/utils';

interface ExamTopicCardListProps {
  topics: ExamTopicItem[];
  onPracticeTopic?: (topicId: number, topicName: string) => void;
  onPracticeExamScope?: (topicIds: number[]) => void;
}

export const ExamTopicCardList: React.FC<ExamTopicCardListProps> = ({
  topics,
  onPracticeTopic,
  onPracticeExamScope,
}) => {
  const dispatch = useDispatch();
  const { examScopeTopicIds, activeTopicId } = useSelector((state: RootState) => state.reader);

  if (!topics || topics.length === 0) return null;

  const topicIds = topics.map(t => t.id);
  const isScopeActive = examScopeTopicIds && topicIds.every(id => examScopeTopicIds.includes(id));
  const totalCards = topics.reduce((acc, t) => acc + (t.flashcards || 0), 0);

  const handleStudyTopic = (topic: ExamTopicItem) => {
    dispatch(setActiveTopicId(topic.id));
    if (topic.page_start) {
      dispatch(setTargetPage(topic.page_start));
    }
  };

  const handleToggleScope = () => {
    if (isScopeActive) {
      dispatch(setExamScopeTopicIds(null));
    } else {
      dispatch(setExamScopeTopicIds(topicIds));
    }
  };

  const getMasteryBadge = (mastery?: string) => {
    switch (mastery?.toLowerCase()) {
      case 'mastered':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Mastered</span>;
      case 'developing':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">Developing</span>;
      case 'fragile':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">Fragile</span>;
      case 'misconception':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">Misconception</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/40">Untested</span>;
    }
  };

  return (
    <div className="my-3 rounded-xl border-2 border-primary/30 bg-surface-container-lowest/80 p-3.5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <GraduationCap size={15} strokeWidth={2.5} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">
              Matched Exam Topics ({topics.length})
            </h4>
          </div>
        </div>
        <button
          onClick={handleToggleScope}
          className={cn(
            "text-[11px] font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all",
            isScopeActive
              ? "bg-primary text-white border-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              : "bg-surface-container-low hover:bg-primary/10 text-primary border-primary/40"
          )}
        >
          {isScopeActive ? <Check size={12} strokeWidth={3} /> : <Filter size={12} />}
          {isScopeActive ? "Exam Scope Active" : "Filter TOC to These"}
        </button>
      </div>

      {/* Topics Stack */}
      <div className="space-y-2">
        {topics.map(topic => {
          const isSelected = activeTopicId === topic.id;
          return (
            <div
              key={topic.id}
              className={cn(
                "p-2.5 rounded-lg border transition-all flex flex-col gap-2",
                isSelected
                  ? "bg-primary/5 border-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
                  : "bg-surface border-outline-variant/40 hover:border-primary/50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-on-surface truncate">
                    {topic.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {topic.page_start && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container-high text-on-surface-variant">
                        {topic.page_start === topic.page_end
                          ? `Slide ${topic.page_start}`
                          : `Slides ${topic.page_start}–${topic.page_end}`}
                      </span>
                    )}
                    {topic.flashcards !== undefined && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container-high text-on-surface-variant flex items-center gap-1">
                        <Layers size={10} />
                        {topic.flashcards} cards
                      </span>
                    )}
                    {getMasteryBadge(topic.mastery)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/20">
                <button
                  onClick={() => handleStudyTopic(topic)}
                  className="flex-1 text-[11px] font-bold py-1 px-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center gap-1 transition-colors"
                >
                  <BookOpen size={12} />
                  Study Topic
                </button>
                {onPracticeTopic && (
                  <button
                    onClick={() => onPracticeTopic(topic.id, topic.title)}
                    className="flex-1 text-[11px] font-bold py-1 px-2 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center gap-1 transition-colors"
                  >
                    <Brain size={12} />
                    Practice Cards
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Actions */}
      {onPracticeExamScope && totalCards > 0 && (
        <button
          onClick={() => onPracticeExamScope(topicIds)}
          className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-primary text-white border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-accent-blue transition-all active:translate-y-px active:shadow-none flex items-center justify-center gap-1.5"
        >
          <Brain size={14} />
          Practice All Exam Cards ({totalCards} Total)
        </button>
      )}
    </div>
  );
};
