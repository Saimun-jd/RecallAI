import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type AIProviderId = 'ollama' | 'openai' | 'gemini' | 'groq';

export interface ProvidersState {
  activeProvider: AIProviderId;
  providerStatus: Record<AIProviderId, 'connected' | 'disconnected' | 'connecting' | 'error'>;
  configuredProviders: Record<AIProviderId, boolean>;
  fallbackToCloudEnabled: boolean;
  showAttributionTags: boolean;
  localModel: { name: string; sizeGB: number; loaded: boolean } | null;
  pdfExtractor: 'pymupdf4llm' | 'marker' | 'marker_api';
}

const initialState: ProvidersState = {
  activeProvider: 'ollama',
  providerStatus: {
    ollama: 'disconnected',
    openai: 'disconnected',
    gemini: 'disconnected',
    groq: 'disconnected',
  },
  configuredProviders: {
    ollama: true, // Local usually doesn't need a key
    openai: false,
    gemini: false,
    groq: false,
  },
  fallbackToCloudEnabled: false,
  showAttributionTags: true,
  localModel: null,
  pdfExtractor: 'pymupdf4llm',
};

const providersSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    setActiveProvider: (state, action: PayloadAction<AIProviderId>) => {
      state.activeProvider = action.payload;
    },
    setProviderStatus: (state, action: PayloadAction<{ provider: AIProviderId; status: ProvidersState['providerStatus'][AIProviderId] }>) => {
      state.providerStatus[action.payload.provider] = action.payload.status;
    },
    setConfiguredProvider: (state, action: PayloadAction<{ provider: AIProviderId; isConfigured: boolean }>) => {
      state.configuredProviders[action.payload.provider] = action.payload.isConfigured;
    },
    setFallbackToCloud: (state, action: PayloadAction<boolean>) => {
      state.fallbackToCloudEnabled = action.payload;
    },
    setShowAttributionTags: (state, action: PayloadAction<boolean>) => {
      state.showAttributionTags = action.payload;
    },
    setLocalModelStatus: (state, action: PayloadAction<ProvidersState['localModel']>) => {
      state.localModel = action.payload;
    },
    setPdfExtractor: (state, action: PayloadAction<'pymupdf4llm' | 'marker' | 'marker_api'>) => {
      state.pdfExtractor = action.payload;
    },
  },
});

export const { 
  setActiveProvider, 
  setProviderStatus, 
  setConfiguredProvider, 
  setFallbackToCloud,
  setShowAttributionTags,
  setLocalModelStatus,
  setPdfExtractor
} = providersSlice.actions;

export default providersSlice.reducer;
