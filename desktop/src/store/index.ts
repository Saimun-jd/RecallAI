import { configureStore } from '@reduxjs/toolkit';
import libraryReducer from './librarySlice';
import readerReducer from './readerSlice';
import commandReducer from './commandSlice';
import reviewReducer from './reviewSlice';
import providersReducer from './providersSlice';

export const store = configureStore({
  reducer: {
    library: libraryReducer,
    reader: readerReducer,
    command: commandReducer,
    review: reviewReducer,
    providers: providersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export * from './librarySlice';
export * from './readerSlice';
export * from './commandSlice';
export * from './reviewSlice';
export * from './providersSlice';
