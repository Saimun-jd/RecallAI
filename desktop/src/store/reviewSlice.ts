import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Flashcard } from '../api/client';

export interface RatingSnapshot {
  cardId: number;
  previousState: any; // The state before the rating was applied
}

export interface ReviewState {
  dueQueue: Flashcard[];
  currentIndex: number;
  isAnswerRevealed: boolean;
  sessionStats: { reviewed: number; correct: number };
  lastRatingSnapshot: RatingSnapshot | null;
}

const initialState: ReviewState = {
  dueQueue: [],
  currentIndex: 0,
  isAnswerRevealed: false,
  sessionStats: { reviewed: 0, correct: 0 },
  lastRatingSnapshot: null,
};

const reviewSlice = createSlice({
  name: 'review',
  initialState,
  reducers: {
    setDueQueue: (state, action: PayloadAction<Flashcard[]>) => {
      state.dueQueue = action.payload;
      state.currentIndex = 0;
      state.isAnswerRevealed = false;
      state.sessionStats = { reviewed: 0, correct: 0 };
    },
    revealAnswer: (state) => {
      state.isAnswerRevealed = true;
    },
    nextCard: (state) => {
      state.currentIndex += 1;
      state.isAnswerRevealed = false;
    },
    incrementSessionStats: (state, action: PayloadAction<{ isCorrect: boolean }>) => {
      state.sessionStats.reviewed += 1;
      if (action.payload.isCorrect) {
        state.sessionStats.correct += 1;
      }
    },
    setLastRatingSnapshot: (state, action: PayloadAction<RatingSnapshot | null>) => {
      state.lastRatingSnapshot = action.payload;
    },
  },
});

export const { setDueQueue, revealAnswer, nextCard, incrementSessionStats, setLastRatingSnapshot } = reviewSlice.actions;
export default reviewSlice.reducer;
