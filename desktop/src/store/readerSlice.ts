import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Flashcard } from '../api/client';

export interface NoteGenerationState {
  isGenerating: boolean;
  topicId: number | null;
  topicTitle?: string;
  progress: number;
  stage?: string;
  current?: number;
  total?: number;
  childTitle?: string;
  message?: string;
  error?: string | null;
  completedAt?: number;
}

export interface TopicProcessingProgress {
  topicId: number;
  topicTitle?: string;
  bookId?: number;
  status: 'processing' | 'queued' | 'completed' | 'error' | 'already_processing';
  stage?: string;
  progress?: number;
  message?: string;
  child_title?: string;
  current?: number;
  total?: number;
}

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
  pdfTheme: 'dark' | 'light';
  noteGeneration: NoteGenerationState | null;
  examScopeTopicIds: number[] | null;
  activeProcessingTopics: Record<number, TopicProcessingProgress>;
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
  pdfTheme: 'dark',
  noteGeneration: null,
  examScopeTopicIds: null,
  activeProcessingTopics: {},
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
    setPdfTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.pdfTheme = action.payload;
    },
    setNoteGeneration: (state, action: PayloadAction<NoteGenerationState | null>) => {
      state.noteGeneration = action.payload;
    },
    updateNoteGenerationProgress: (state, action: PayloadAction<Partial<NoteGenerationState>>) => {
      if (state.noteGeneration) {
        state.noteGeneration = { ...state.noteGeneration, ...action.payload };
      }
    },
    setExamScopeTopicIds: (state, action: PayloadAction<number[] | null>) => {
      state.examScopeTopicIds = action.payload;
    },
    clearExamScope: (state) => {
      state.examScopeTopicIds = null;
    },
    setTopicProcessing: (state, action: PayloadAction<TopicProcessingProgress>) => {
      state.activeProcessingTopics[action.payload.topicId] = action.payload;
    },
    updateTopicProcessingProgress: (state, action: PayloadAction<Partial<TopicProcessingProgress> & { topicId: number }>) => {
      const existing = state.activeProcessingTopics[action.payload.topicId];
      if (existing) {
        state.activeProcessingTopics[action.payload.topicId] = { ...existing, ...action.payload };
      } else {
        state.activeProcessingTopics[action.payload.topicId] = {
          topicId: action.payload.topicId,
          status: 'processing',
          ...action.payload,
        };
      }
    },
    clearTopicProcessing: (state, action: PayloadAction<number>) => {
      delete state.activeProcessingTopics[action.payload];
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
  setSearchQuery,
  setPdfTheme,
  setNoteGeneration,
  updateNoteGenerationProgress,
  setExamScopeTopicIds,
  clearExamScope,
  setTopicProcessing,
  updateTopicProcessingProgress,
  clearTopicProcessing,
} = readerSlice.actions;
export default readerSlice.reducer;
