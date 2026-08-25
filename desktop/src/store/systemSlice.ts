import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SystemState {
  sidecarStatus: 'connected' | 'error' | 'booting';
}

const initialState: SystemState = {
  sidecarStatus: 'booting',
};

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setSidecarStatus(state, action: PayloadAction<'connected' | 'error' | 'booting'>) {
      state.sidecarStatus = action.payload;
    },
  },
});

export const { setSidecarStatus } = systemSlice.actions;
export default systemSlice.reducer;
