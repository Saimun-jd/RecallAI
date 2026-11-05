import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface CloudUploadState {
  isUploading: boolean;
  progress: number;
  fileName: string;
}

interface SystemState {
  sidecarStatus: 'connected' | 'error' | 'booting';
  cloudUploadState: CloudUploadState | null;
}

const initialState: SystemState = {
  sidecarStatus: 'booting',
  cloudUploadState: null,
};

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setSidecarStatus(state, action: PayloadAction<'connected' | 'error' | 'booting'>) {
      state.sidecarStatus = action.payload;
    },
    setCloudUploadState(state, action: PayloadAction<CloudUploadState | null>) {
      state.cloudUploadState = action.payload;
    }
  },
});

export const { setSidecarStatus, setCloudUploadState } = systemSlice.actions;
export default systemSlice.reducer;
