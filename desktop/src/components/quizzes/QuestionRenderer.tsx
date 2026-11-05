import React, { useEffect, useCallback } from 'react';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';
import type { MaskedQuizQuestion } from '../../api/client';

export interface QuestionRendererProps {
  question: MaskedQuizQuestion;
  selectedAnswer?: string;
  onSelectAnswer: (answer: string) => void;
  disabled?: boolean;
}

export function QuestionRenderer({
  question,
  selectedAnswer,
  onSelectAnswer,
  disabled,
}: QuestionRendererProps) {
  // Keyboard shortcut listener for active question choices
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (question.type === 'true_false') {
        if (e.key === '1' || e.key.toLowerCase() === 't') {
          e.preventDefault();
          onSelectAnswer('true');
        } else if (e.key === '2' || e.key.toLowerCase() === 'f') {
          e.preventDefault();
          onSelectAnswer('false');
        }
      } else {
        // Multiple choice: numeric keys 1, 2, 3, 4 ... or letters A, B, C, D
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= question.options.length) {
          e.preventDefault();
          onSelectAnswer(String(num - 1));
        } else {
          const letterIndex = ['a', 'b', 'c', 'd', 'e', 'f'].indexOf(e.key.toLowerCase());
          if (letterIndex !== -1 && letterIndex < question.options.length) {
            e.preventDefault();
            onSelectAnswer(String(letterIndex));
          }
        }
      }
    },
    [disabled, question, onSelectAnswer]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (question.type === 'true_false') {
    return (
      <TrueFalseQuestion
        question={question}
        selectedAnswer={selectedAnswer}
        onSelectAnswer={onSelectAnswer}
        disabled={disabled}
      />
    );
  }

  return (
    <MultipleChoiceQuestion
      question={question}
      selectedAnswer={selectedAnswer}
      onSelectAnswer={onSelectAnswer}
      disabled={disabled}
    />
  );
}
