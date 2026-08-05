import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface FlattenedTopic {
  id: number;
  bookId: number;
  title: string;
  breadcrumb: string;
  startPage: number;
}

export interface CommandState {
  isOpen: boolean;
  query: string;
  searchIndex: FlattenedTopic[];
}

const initialState: CommandState = {
  isOpen: false,
  query: '',
  searchIndex: [],
};

const commandSlice = createSlice({
  name: 'command',
  initialState,
  reducers: {
    setCommandOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpen = action.payload;
    },
    setCommandQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    setSearchIndex: (state, action: PayloadAction<FlattenedTopic[]>) => {
      state.searchIndex = action.payload;
    },
  },
});

export const { setCommandOpen, setCommandQuery, setSearchIndex } = commandSlice.actions;
export default commandSlice.reducer;
