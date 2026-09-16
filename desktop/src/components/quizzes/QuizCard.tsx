import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, BookOpen, MoreVertical, Trash2, Pencil, Play } from 'lucide-react';
import { Card } from '../ui/Card';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/DropdownMenu';
import type { QuizResponse } from '../../api/client';

export interface QuizCardProps {
  quiz: QuizResponse;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export function QuizCard({ quiz, onRename, onDelete }: QuizCardProps) {
  const navigate = useNavigate();

  const formattedDate = new Date(quiz.updated_at || quiz.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const getDifficultyVariant = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'success' as const;
      case 'hard':
        return 'error' as const;
      case 'medium':
      default:
        return 'warning' as const;
    }
  };

  return (
    <Card
      variant="interactive"
      size="none"
      className="flex flex-col overflow-hidden group"
      onClick={() => navigate(`/app/quizzes/${quiz.id}`)}
      role="article"
      aria-label={`Quiz: ${quiz.title}`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0">
            <HelpCircle size={18} />
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg border border-transparent hover:border-border-default hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  aria-label="Quiz actions"
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" width="w-36">
                <DropdownMenuItem onClick={() => onRename(quiz.id)} icon={<Pencil size={13} />}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => onDelete(quiz.id)} icon={<Trash2 size={13} />}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5 min-w-0">
          <h3 className="font-black text-sm sm:text-base text-on-surface leading-tight truncate">
            {quiz.title}
          </h3>
          {quiz.description && (
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed line-clamp-2">
              {quiz.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tag variant="primary" size="xs">
            {quiz.question_count} {quiz.question_count === 1 ? 'question' : 'questions'}
          </Tag>
          {quiz.difficulty && (
            <Tag variant={getDifficultyVariant(quiz.difficulty)} size="xs" className="capitalize">
              {quiz.difficulty}
            </Tag>
          )}
          {quiz.source_document_ids && quiz.source_document_ids.length > 0 && (
            <Tag variant="default" size="xs">
              <BookOpen size={10} className="shrink-0" />
              <span>{quiz.source_document_ids.length} {quiz.source_document_ids.length === 1 ? 'source' : 'sources'}</span>
            </Tag>
          )}
          <span className="text-[10px] text-on-surface-variant font-bold ml-auto">{formattedDate}</span>
        </div>
      </div>

      {/* Footer Action */}
      <div className="px-4 sm:px-5 py-3 border-t-2 border-border-default/60 bg-surface-container-low/30">
        <Button
          variant="primary"
          size="sm"
          className="w-full justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-neo-sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/quizzes/${quiz.id}`);
          }}
          disabled={quiz.question_count === 0}
        >
          <Play size={13} />
          <span>Start Assessment</span>
        </Button>
      </div>
    </Card>
  );
}
