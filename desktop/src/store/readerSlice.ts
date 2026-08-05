import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Flashcard } from '../api/client';

export interface ReaderState {
  activeTopicId: number | null;
  currentPage: number;
  targetPage: number | null;
  activeTab: 'notes' | 'flashcards';
  isPdfDrawerOpen: boolean;
  isCardGenModalOpen: boolean;
  isNotesOpen: boolean;
  activeTopicCards: Flashcard[];
  searchQuery: string;
}

const initialState: ReaderState = {
  activeTopicId: null,
  currentPage: 1,
  targetPage: null,
  activeTab: 'notes',
  isPdfDrawerOpen: false,
  isCardGenModalOpen: false,
  isNotesOpen: false,
  activeTopicCards: [],
  searchQuery: '',
};

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    setActiveTopicId: (state, action: PayloadAction<number | null>) => {
      state.activeTopicId = action.payload;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setTargetPage: (state, action: PayloadAction<number | null>) => {
      state.targetPage = action.payload;
    },
    setActiveTab: (state, action: PayloadAction<'notes' | 'flashcards'>) => {
      state.activeTab = action.payload;
    },
    setIsPdfDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.isPdfDrawerOpen = action.payload;
    },
    setIsCardGenModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isCardGenModalOpen = action.payload;
    },
    setIsNotesOpen: (state, action: PayloadAction<boolean>) => {
      state.isNotesOpen = action.payload;
    },
    setActiveTopicCards: (state, action: PayloadAction<Flashcard[]>) => {
      state.activeTopicCards = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
});

export const { 
  setActiveTopicId, 
  setCurrentPage, 
  setTargetPage, 
  setActiveTab,
  setIsPdfDrawerOpen,
  setIsCardGenModalOpen,
  setIsNotesOpen,
  setActiveTopicCards,
  setSearchQuery
} = readerSlice.actions;
export default readerSlice.reducer;
