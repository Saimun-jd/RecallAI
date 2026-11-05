import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, BookOpen, MoreVertical, Trash2, Pencil, Play } from 'lucide-react';
import { Card } from '../ui/Card';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/DropdownMenu';
import type { FlashcardSetItem } from '../../api/client';

export interface FlashcardSetCardProps {
  set: FlashcardSetItem;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FlashcardSetCard({ set, onRename, onDelete }: FlashcardSetCardProps) {
  const navigate = useNavigate();

  const formattedDate = new Date(set.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      variant="interactive"
      size="none"
      className="flex flex-col overflow-hidden group"
      onClick={() => navigate(`/app/flashcards/${set.id}`)}
      role="article"
      aria-label={`Flashcard set: ${set.title}`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <BrainCircuit size={18} />
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg border border-transparent hover:border-border-default hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Set actions"
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" width="w-36">
                <DropdownMenuItem onClick={() => onRename(set.id)} icon={<Pencil size={13} />}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => onDelete(set.id)} icon={<Trash2 size={13} />}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5 min-w-0">
          <h3 className="font-black text-sm sm:text-base text-on-surface leading-tight truncate">
            {set.title}
          </h3>
          {set.description && (
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed line-clamp-2">
              {set.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tag variant="primary" size="xs">
            {set.card_count} {set.card_count === 1 ? 'card' : 'cards'}
          </Tag>
          {set.source_document_ids.length > 0 && (
            <Tag variant="default" size="xs">
              <BookOpen size={10} className="shrink-0" />
              {set.source_document_ids.length} {set.source_document_ids.length === 1 ? 'source' : 'sources'}
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
          className="w-full justify-center gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/flashcards/${set.id}/study`);
          }}
          disabled={set.card_count === 0}
        >
          <Play size={13} />
          <span>Study</span>
        </Button>
      </div>
    </Card>
  );
}
