import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  sidecarStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastPolled: number | null;
}

const initialState: AppState = {
  sidecarStatus: 'connecting',
  lastPolled: null,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setSidecarStatus: (state, action: PayloadAction<AppState['sidecarStatus']>) => {
      state.sidecarStatus = action.payload;
      if (action.payload === 'connected') {
        state.lastPolled = Date.now();
      }
    },
  },
});

export const { setSidecarStatus } = appSlice.actions;
export default appSlice.reducer;
