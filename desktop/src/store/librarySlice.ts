import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Book, TocEntry, ProgressEvent } from '../api/client';

export interface LibraryState {
  books: Book[];
  activeBook: Book | null;
  tocTree: TocEntry[];
  isUploading: boolean;
  ingestionProgress: { current: number; total: number; topic: string; status: 'processing' | 'complete' | 'error'; error?: string; percentage?: number; } | null;
}

const initialState: LibraryState = {
  books: [],
  activeBook: null,
  tocTree: [],
  isUploading: false,
  ingestionProgress: null,
};

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    setBooks: (state, action: PayloadAction<Book[]>) => {
      state.books = action.payload;
    },
    setActiveBook: (state, action: PayloadAction<Book | null>) => {
      state.activeBook = action.payload;
    },
    setTocTree: (state, action: PayloadAction<TocEntry[]>) => {
      state.tocTree = action.payload;
    },
    setIsUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
    },
    setIngestionProgress: (state, action: PayloadAction<LibraryState['ingestionProgress']>) => {
      state.ingestionProgress = action.payload;
    },
  },
});

export const { setBooks, setActiveBook, setTocTree, setIsUploading, setIngestionProgress } = librarySlice.actions;
export default librarySlice.reducer;
