import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { parseApiError, parseSSEError, type ApiError } from './errors';
import { isTauriEnvironment } from './keychain';
import { MAX_PDF_BYTES, formatFileSize, validateDocumentFile } from '../utils/fileValidation';

const fetch = async (url: string, options?: any) => {
  const fetchFn = isTauriEnvironment() ? tauriFetch : window.fetch.bind(window);
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('recall_token') : null;
  const mergedOptions = { ...options };
  
  if (token && !mergedOptions.headers?.Authorization && !mergedOptions.headers?.authorization) {
    mergedOptions.headers = {
      ...mergedOptions.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  const res = await fetchFn(url, mergedOptions);

  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-unauthorized'));
  }

  if (options && options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
    if (res.ok) {
      window.dispatchEvent(new Event('trigger-sync'));
    }
  }
  return res;
};

export interface TocEntry {
  level: number;
  title: string;
  start_page: number;
  end_page: number;
}

export interface UploadResponse {
  book_id: number;
  status: string;
  topic_count: number;
}

export interface SectionSelection {
  title: string;
  start_page: number;
  end_page: number;
}

export interface ProgressEvent {
  status: string;
  chunk?: number;
  total_chunks?: number;
  current_topic?: string;
  completed_sections?: number;
  total_sections?: number;
  book_id?: number;
  error?: string;
  error_code?: string;
  _apiError?: ApiError;
}

export interface PdfSyncProgressEvent {
  status: 'downloading' | 'complete' | 'error';
  current?: number;
  total?: number;
  title?: string;
  percentage?: number;
  message?: string;
}

export const API_BASE = "http://127.0.0.1:8000";

export interface PromptVariable {
  name: string;
  description: string;
  required: boolean;
}

export interface SystemPrompt {
  key: string;
  name: string;
  category: string;
  title?: string;
  description: string;
  default_template: string;
  custom_template?: string | null;
  current_template: string;
  variables: PromptVariable[];
  is_custom?: boolean;
  is_customized?: boolean;
  model_target?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TokenUsageTotals {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_estimated_cost?: number;
  total_cost_usd: number;
  total_requests: number;
}

export interface TokenUsageByFeature {
  feature: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
  estimated_cost_usd?: number;
  requests: number;
}

export interface TokenUsageByProvider {
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
  estimated_cost_usd?: number;
  requests: number;
}

export interface TokenUsageByModel {
  model: string;
  provider?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
  estimated_cost_usd?: number;
  requests: number;
}

export interface TokenDailyPoint {
  date?: string;
  day?: string;
  total_tokens: number;
  estimated_cost?: number;
  estimated_cost_usd?: number;
  requests: number;
}

export interface TokenUsageSummary {
  totals: TokenUsageTotals;
  by_feature: TokenUsageByFeature[];
  by_provider: TokenUsageByProvider[];
  by_model: TokenUsageByModel[];
  daily_timeline: TokenDailyPoint[];
}

export interface TokenLogEntry {
  id: number;
  timestamp: string;
  provider: string;
  model: string;
  feature: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
  estimated_cost_usd: number;
  execution_time_ms?: number;
  book_id?: number | null;
  topic_id?: number | null;
}

export interface Book {
  id: number;
  uuid?: string;
  title: string;
  file_path: string;
  file_hash: string;
  total_pages: number;
  created_at: string;
  last_read_at?: string | null;
  last_read_page?: number | null;
  last_topic_id?: number | null;
  total_topics?: number;
  topics_processed?: number;
}

export interface AtomicConcept {
  id: string;
  name: string;
  concept_type: 'Definition' | 'Key Feature' | 'Formula' | 'Comparison' | 'Process Step' | 'Code Example' | 'Diagram' | string;
  summary: string;
  key_terms: string[];
  mastery_score?: number | null;
  mastery_status?: 'untested' | 'mastered' | 'developing' | 'fragile' | 'misconception';
  last_drilled_at?: string | null;
  section_heading?: string | null;
  related_code_id?: string | null;
  related_image_id?: string | null;
}

export interface Topic {
  id: number;
  book_id: number;
  parent_id?: number | null;
  topic_hash: string;
  title: string;
  level: number;
  start_page: number;
  end_page: number;
  sort_order: number;
  breadcrumb?: string;
  status?: 'unprocessed' | 'processing' | 'processed';
  embedding?: any;
  summary?: string;
  concept_type?: string;
  key_terms?: string;
  atomic_concepts?: string;
  content_md?: string;
  code_snippet?: string;
  image_url?: string;
  is_processed?: boolean | number;
  mastery_score?: number | null;
  mastery_status?: 'untested' | 'mastered' | 'developing' | 'fragile' | 'misconception';
  last_drilled_at?: string | null;
  created_at?: string;
  uuid?: string;
}

export interface Flashcard {
  id: number;
  topic_id: number;
  topic_name: string;
  concept_type: string;
  summary: string;
  question: string;
  answer: string;
  key_terms: string;
  content_hash: string;
  state: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: string | null;
  due: string | null;
}

export interface RelatedTopic {
  id: number;
  title: string;
  breadcrumb: string;
  summary: string;
  similarity: number;
}

export interface AnalyticsStats {
  totals: {
    books: number;
    topics: number;
    flashcards: number;
    total_reviews: number;
  };
  queue: {
    new: number;
    learning: number;
    review: number;
    due_now: number;
  };
  fsrs_metrics: {
    average_stability_days: number;
    average_difficulty: number;
  };
  forecast_7d: Array<{
    date: string;
    due_count: number;
  }>;
}

export interface PdfAnnotation {
  id: number;
  book_id: number;
  page_number: number;
  annotation_type: 'ai_explanation' | 'sidenote' | 'flashcard_link';
  selected_text: string;
  rect_json: string;
  content: string | null;
  custom_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteItem {
  id: number;
  topic_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  uuid?: string;
  topic_title: string;
  breadcrumb?: string;
  level: number;
  start_page: number;
  end_page: number;
  book_id: number;
  book_title: string;
}

export interface NoteAnnotationItem {
  id: number;
  book_id: number;
  book_title: string;
  page_number: number;
  annotation_type: string;
  selected_text: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ── Socratic Drill Types ───────────────────────────────────────────────

export interface DiagnosticQuestion {
  id: string;
  tier: 'causal_mechanism' | 'counterfactual' | 'applied_scenario';
  question_text: string;
  key_invariants: string[];
  socratic_hint: string;
  reference_page: number | null;
}

export interface DiagnosticQuestionSet {
  topic_title: string;
  concept_name?: string | null;
  questions: DiagnosticQuestion[];
}

export interface SuggestedFlashcard {
  question: string;
  answer: string;
  gap_source: string;
}

export interface ExamMisconception {
  pitfall: string;
  theory: string;
  exam_tip: string;
}

export interface DiagnosedGap {
  gap: string;
  context: string;
  why_it_matters?: string | null;
}

export interface DiagnosticEvaluation {
  concept_name?: string | null;
  mastery_score: number;
  status: 'mastered' | 'developing' | 'fragile' | 'misconception';
  strengths: string[];
  diagnosed_gaps: DiagnosedGap[];
  misconceptions: ExamMisconception[];
  socratic_nudge?: string | null;
  suggested_flashcards: SuggestedFlashcard[];
}

export interface ExamTopicItem {
  id: number;
  title: string;
  page_start?: number;
  page_end?: number;
  flashcards: number;
  mastery?: 'mastered' | 'developing' | 'fragile' | 'misconception' | 'untested';
  summary?: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'ai' | 'system' | 'assistant';
  content: string;
  created_at?: string;
}

export interface ChatRequest {
  topic_id?: number | null;
  book_id?: number | null;
  topic_name?: string;
  context_markdown?: string;
  question: string;
  history?: ChatMessage[];
  provider_override?: string | null;
}

export const client = {
  /** Parse structured API errors and throw as ApiError */
  async _throwIfError(res: Response, fallbackMsg: string): Promise<void> {
    if (!res.ok) {
      throw await parseApiError(res);
    }
  },

  async updateReadingState(bookId: number, pageNumber?: number, topicId?: number | null): Promise<void> {
    const res = await fetch(`${API_BASE}/books/${bookId}/reading-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_number: pageNumber, topic_id: topicId }),
    });
    await this._throwIfError(res, 'Failed to update reading state');
  },

  async getBooks(): Promise<Book[]> {
    const res = await fetch(`${API_BASE}/books`);
    await this._throwIfError(res, "Failed to fetch books");
    return res.json();
  },
  async getBook(id: number): Promise<Book> {
    const res = await fetch(`${API_BASE}/books/${id}`);
    await this._throwIfError(res, "Failed to fetch book");
    return res.json();
  },
  async deleteBook(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/books/${id}`, { method: "DELETE" });
    await this._throwIfError(res, "Failed to delete book");
    return res.json();
  },
  async syncWithRemote(token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    await this._throwIfError(res, "Failed to synchronize with remote");
  },
  async getTopics(bookId?: number): Promise<Topic[]> {
    const url = bookId ? `${API_BASE}/topics?book_id=${bookId}` : `${API_BASE}/topics`;
    const res = await fetch(url);
    await this._throwIfError(res, "Failed to fetch topics");
    return res.json();
  },
  async reparseHandwriting(bookId: number): Promise<{ book_id: number; topic_count: number; topics: any[] }> {
    const res = await fetch(`${API_BASE}/books/${bookId}/reparse-handwriting`, {
      method: "POST",
    });
    await this._throwIfError(res, "Failed to analyze handwritten notes");
    return res.json();
  },
  async reparseHandwritingStream(
    bookId: number,
    onProgress: (event: { stage?: string; status?: string; message?: string; progress?: number; topic_count?: number; topics?: any[] }) => void
  ): Promise<{ book_id: number; topic_count: number; topics: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/books/${bookId}/reparse-handwriting-stream`, {
        method: "POST",
        headers: { "Accept": "text/event-stream" }
      });
      if (!res.ok) throw await parseApiError(res);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          if (chunk.startsWith("data: ")) {
            const dataStr = chunk.slice(6);
            try {
              const data = JSON.parse(dataStr);
              onProgress(data);
              if (data.status === 'error') {
                throw new Error(data.message || 'Failed to analyze handwriting');
              }
              if (data.status === 'complete' || data.stage === 'complete') {
                finalResult = {
                  book_id: bookId,
                  topic_count: data.topic_count || (data.topics ? data.topics.length : 0),
                  topics: data.topics || []
                };
              }
            } catch (e: any) {
              if (e?.message && e.message.includes('Failed to analyze')) throw e;
              console.error("Failed to parse SSE event", e);
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (finalResult) return finalResult;
    } catch (err: any) {
      console.warn("SSE reparse stream failed, falling back to direct reparse:", err);
    }

    // Fallback to direct HTTP endpoint
    return this.reparseHandwriting(bookId);
  },
  async getTopic(id: number): Promise<Topic> {
    const res = await fetch(`${API_BASE}/topics/${id}`);
    await this._throwIfError(res, "Failed to fetch topic");
    return res.json();
  },
  async getFlashcard(id: number): Promise<Flashcard> {
    const res = await fetch(`${API_BASE}/flashcards/${id}`);
    await this._throwIfError(res, "Failed to fetch flashcard");
    return res.json();
  },
  async updateFlashcard(
    idOrCardId: number | string,
    dataOrPayload: any
  ): Promise<any> {
    if (typeof idOrCardId === 'number') {
      const res = await fetch(`${API_BASE}/flashcards/${idOrCardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataOrPayload),
      });
      await this._throwIfError(res, "Failed to update flashcard");
      return res.json();
    } else {
      const res = await fetch(`${API_BASE}/api/v1/flashcards/cards/${idOrCardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataOrPayload),
      });
      if (!res.ok) throw await parseApiError(res);
      const json = await res.json();
      return json.data;
    }
  },

  async deleteFlashcard(idOrCardId: number | string): Promise<any> {
    if (typeof idOrCardId === 'number') {
      const res = await fetch(`${API_BASE}/flashcards/${idOrCardId}`, { method: "DELETE" });
      await this._throwIfError(res, "Failed to delete flashcard");
      return res.json();
    } else {
      const res = await fetch(`${API_BASE}/api/v1/flashcards/cards/${idOrCardId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw await parseApiError(res);
      const json = await res.json();
      return json.data;
    }
  },
  async getSettings(): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE}/settings`);
    await this._throwIfError(res, "Failed to fetch settings");
    return res.json();
  },
  async updateSetting(key: string, value: string): Promise<{ status: string; key: string; value: string }> {
    const res = await fetch(`${API_BASE}/settings/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    await this._throwIfError(res, "Failed to update setting");
    return res.json();
  },
  async saveApiKeys(keys: { gemini_api_key?: string, groq_api_key?: string, openai_api_key?: string, datalab_api_key?: string, langfuse_secret_key?: string, langfuse_public_key?: string, langfuse_host?: string, ollama_host?: string }): Promise<{ status: string }> {
    try {
      const res = await fetch(`${API_BASE}/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys),
      });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    } catch (error: any) {
      if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
        throw new Error("Backend HTTP sync failed. The Python sidecar might be offline.");
      }
      throw error;
    }
  },
  async verifyApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; provider: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/verify-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    await this._throwIfError(res, "Failed to verify API key");
    return res.json();
  },

  async verifyOllama(url: string): Promise<{ active: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/settings/verify-ollama?url=${encodeURIComponent(url)}`);
    return res.json();
  },
  async resetFlashcard(id: number): Promise<{ message: string; flashcard_id: number }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}/reset`, { method: "POST" });
    await this._throwIfError(res, "Failed to reset flashcard");
    return res.json();
  },
  async getDueCards(limit: number = 20): Promise<Flashcard[]> {
    const res = await fetch(`${API_BASE}/flashcards/due?limit=${limit}`);
    await this._throwIfError(res, "Failed to fetch due cards");
    return res.json();
  },
  async submitReview(id: number, rating: number): Promise<{ message: string; next_due: string }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    await this._throwIfError(res, "Failed to submit review");
    return res.json();
  },
  async undoReview(id: number): Promise<{ message: string; flashcard_id: number }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}/undo-review`, {
      method: "POST",
    });
    await this._throwIfError(res, "Failed to undo review");
    return res.json();
  },
  async searchAll(query: string, limit: number = 20): Promise<Array<{ type: string; id: number; title: string; subtitle: string; book_id?: number }>> {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    await this._throwIfError(res, "Search failed");
    return res.json();
  },
  async getAnalytics(): Promise<AnalyticsStats> {
    const res = await fetch(`${API_BASE}/analytics/stats`);
    await this._throwIfError(res, "Failed to fetch analytics");
    return res.json();
  },
  async checkHealth(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/health`);
    await this._throwIfError(res, "Backend not healthy");
    return res.json();
  },
  async uploadPdfAndGetToc(
    file: File, 
    bookTitle: string, 
    totalPages: number, 
    existingHash?: string,
    onUploadProgress?: (percent: number) => void
  ): Promise<UploadResponse> {
    if (file.size > MAX_PDF_BYTES) {
      throw {
        userMessage: `PDF exceeds maximum allowed size of 50 MB (${formatFileSize(file.size)}).`,
        message: 'Payload too large',
        status: 413,
      };
    }

    const fileHash = existingHash || Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
      .map(b => b.toString(16).padStart(2, "0")).join("");
      
    const formData = new FormData();
    formData.append("file", file);
    formData.append("book_title", bookTitle);
    formData.append("file_hash", fileHash);
    formData.append("total_pages", totalPages.toString());
    
    if (onUploadProgress) {
      return new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/books/upload`, true);
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onUploadProgress(percent);
          }
        };
        
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('trigger-sync'));
              }
              resolve(body as UploadResponse);
            } else {
              let msg = `Request failed with status ${xhr.status}`;
              let code = 'INTERNAL_ERROR';
              let detail: string | undefined;
              if (body?.error && typeof body.error === 'object') {
                code = body.error.code || code;
                msg = body.error.message || msg;
                detail = body.error.details;
              } else if (body?.detail) {
                msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
              } else if (body?.message) {
                msg = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
              }
              const err: any = new Error(msg);
              err.errorCode = code;
              err.userMessage = msg;
              err.httpStatus = xhr.status;
              err.debugDetail = detail;
              reject(err);
            }
          } catch {
            const err: any = new Error(`Upload failed with status ${xhr.status}`);
            err.httpStatus = xhr.status;
            reject(err);
          }
        };
        
        xhr.onerror = () => {
          const err: any = new Error("Network error during file upload. Please check your connection.");
          err.userMessage = "Network error during file upload. Please check your connection.";
          reject(err);
        };
        
        xhr.send(formData);
      });
    }

    const res = await fetch(`${API_BASE}/books/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw await parseApiError(res);
    return res.json();
  },
  
  async processTopicStream(topicId: number, activeProvider: string, onEvent: (event: any) => void): Promise<void> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/process-stream`, {
      method: "POST",
      headers: { "Accept": "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ provider_override: activeProvider })
    });
    
    if (!res.ok) throw await parseApiError(res);
    if (!res.body) throw new Error("No response body");
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finishedCleanly = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (chunk.startsWith("data: ")) {
            const dataStr = chunk.slice(6);
            try {
              const data = JSON.parse(dataStr);
              onEvent(data);
              if (data.status === 'error') {
                const apiErr = parseSSEError(data);
                throw apiErr;
              }
              if (data.status === 'complete' || data.stage === 'complete') {
                finishedCleanly = true;
              }
            } catch (e) {
              if ((e as any)?.errorCode || (e as any)?.userMessage) throw e;
              console.error("Failed to parse SSE event", e);
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (!finishedCleanly) {
        throw new Error("Connection lost before processing completed.");
      }
    } finally {
      reader.releaseLock();
    }
  },
  
  async processSectionsStream(bookId: number, sections: SectionSelection[], provider: string | null = null, onProgress: (event: ProgressEvent) => void): Promise<void> {
    const res = await fetch(`${API_BASE}/books/${bookId}/process-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selected_sections: sections,
        provider: provider
      }),
    });
    
    if (!res.ok) throw await parseApiError(res);
    
    if (!res.body) throw new Error("No response body");
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finishedCleanly = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (chunk.startsWith("data: ")) {
            const dataStr = chunk.slice(6);
            try {
              const data = JSON.parse(dataStr) as ProgressEvent;
              onProgress(data);
              if (data.status === 'error') {
                const apiErr = parseSSEError(data);
                throw apiErr;
              }
              if (data.status === 'complete') {
                finishedCleanly = true;
              }
            } catch (e) {
              if ((e as any)?.errorCode || (e as any)?.userMessage) throw e;
              console.error("Failed to parse SSE event", e);
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (!finishedCleanly) {
        throw new Error("Connection lost before processing completed.");
      }
    } finally {
      reader.releaseLock();
    }
  },
  
  async getNote(topicId: number): Promise<{ topic_id: number; note: string }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes`);
    await this._throwIfError(res, "Failed to fetch note");
    return res.json();
  },
  
  async updateNote(topicId: number, note: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    await this._throwIfError(res, "Failed to update note");
    return res.json();
  },

  async generateNoteScaffold(topicId: number, providerOverride?: string | null): Promise<{ topic_id: number; scaffold: string; note: string; children_count?: number }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes/scaffold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_override: providerOverride || null }),
    });
    await this._throwIfError(res, "Failed to generate note scaffold");
    return res.json();
  },

  async generateNoteScaffoldStream(
    topicId: number,
    providerOverride?: string,
    onEvent?: (event: any) => void
  ): Promise<{ topic_id?: number; scaffold: string; note: string; children_count?: number }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes/scaffold-stream`, {
      method: "POST",
      headers: { "Accept": "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ provider_override: providerOverride || null }),
    });

    if (!res.ok) throw await parseApiError(res);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let resultPayload: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          if (chunk.startsWith("data: ")) {
            const dataStr = chunk.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (onEvent) onEvent(data);

              if (data.status === 'error') {
                const apiErr = parseSSEError(data);
                throw apiErr;
              }
              if (data.status === 'complete' || data.stage === 'complete') {
                resultPayload = data;
              }
            } catch (jsonErr: any) {
              if (jsonErr?.isRecallError) throw jsonErr;
              console.warn("Failed to parse SSE note chunk:", dataStr);
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } finally {
      reader.releaseLock();
    }

    return resultPayload || { scaffold: "", note: "" };
  },

  async uploadNoteImage(file: File): Promise<{ status: string; filename: string; url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/notes/upload-image`, {
      method: "POST",
      body: formData,
    });
    await this._throwIfError(res, "Failed to upload image");
    return res.json();
  },

  async appendNote(topicId: number, content: string, sectionTitle?: string): Promise<{ status: string; note: string }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes/append`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, section_title: sectionTitle || null }),
    });
    await this._throwIfError(res, "Failed to append to note");
    return res.json();
  },

  async getAllNotes(bookId?: number, search?: string): Promise<NoteItem[]> {
    const params = new URLSearchParams();
    if (bookId !== undefined) params.append('book_id', bookId.toString());
    if (search && search.trim()) params.append('search', search.trim());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/notes${query}`);
    await this._throwIfError(res, "Failed to fetch all notes");
    return res.json();
  },

  async getAllAnnotations(bookId?: number): Promise<NoteAnnotationItem[]> {
    const query = bookId !== undefined ? `?book_id=${bookId}` : '';
    const res = await fetch(`${API_BASE}/notes/annotations${query}`);
    await this._throwIfError(res, "Failed to fetch all annotations");
    return res.json();
  },

  async deleteNote(topicId: number): Promise<{ status: string; deleted: boolean }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes`, {
      method: "DELETE",
    });
    await this._throwIfError(res, "Failed to delete note");
    return res.json();
  },
  
  async getTopicFlashcards(topicId?: number): Promise<Flashcard[]> {
    const url = topicId ? `${API_BASE}/flashcards?topic_id=${topicId}` : `${API_BASE}/flashcards`;
    const res = await fetch(url);
    await this._throwIfError(res, "Failed to fetch flashcards");
    return res.json();
  },
  
  async getRelatedTopics(topicId: number, limit: number = 5): Promise<RelatedTopic[]> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/related?limit=${limit}`);
    await this._throwIfError(res, "Failed to fetch related topics");
    return res.json();
  },
  
  async generateFlashcards(
    topicIdOrPayload: number | FlashcardGenerateRequest,
    options?: { count: number; custom_prompt?: string, provider_override?: string; concept_name?: string }
  ): Promise<any> {
    if (typeof topicIdOrPayload === 'number') {
      const res = await fetch(`${API_BASE}/topics/${topicIdOrPayload}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      });
      if (!res.ok) {
        throw await parseApiError(res);
      }
      return res.json();
    } else {
      const res = await fetch(`${API_BASE}/api/v1/flashcards/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicIdOrPayload),
      });
      if (!res.ok) throw await parseApiError(res);
      const json = await res.json();
      return json.data;
    }
  },

  // ─── PDF Annotation API ───

  async getAnnotations(bookId: number, pageNumber?: number): Promise<PdfAnnotation[]> {
    const url = pageNumber !== undefined
      ? `${API_BASE}/books/${bookId}/annotations?page=${pageNumber}`
      : `${API_BASE}/books/${bookId}/annotations`;
    const res = await fetch(url);
    await this._throwIfError(res, "Failed to fetch annotations");
    return res.json();
  },

  async createAnnotation(bookId: number, data: {
    page_number: number;
    annotation_type: string;
    selected_text: string;
    rect_json: string;
    content?: string;
    custom_prompt?: string;
  }): Promise<{ id: number; status: string }> {
    const res = await fetch(`${API_BASE}/books/${bookId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await this._throwIfError(res, "Failed to create annotation");
    return res.json();
  },

  async explainText(bookId: number, data: {
    selected_text: string;
    custom_prompt?: string;
    page_number: number;
    rect_json: string;
    save?: boolean;
    provider_override?: string;
  }): Promise<PdfAnnotation> {
    const res = await fetch(`${API_BASE}/books/${bookId}/annotations/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw await parseApiError(res);
    }
    return res.json();
  },

  async generateFlashcardsFromSelection(bookId: number, data: {
    selected_text: string;
    custom_prompt?: string;
    count: number;
    page_number: number;
    rect_json: string;
    save?: boolean;
    provider_override?: string;
  }): Promise<{ id: number; flashcards: Array<{ question: string; answer: string }> }> {
    const res = await fetch(`${API_BASE}/books/${bookId}/annotations/generate-flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw await parseApiError(res);
    }
    return res.json();
  },

  async updateAnnotation(annotationId: number, content: string): Promise<void> {
    const res = await fetch(`${API_BASE}/annotations/${annotationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await this._throwIfError(res, "Failed to update annotation");
  },

  async deleteAnnotation(annotationId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/annotations/${annotationId}`, {
      method: "DELETE",
    });
    await this._throwIfError(res, "Failed to delete annotation");
  },

  // ── Socratic Drill Methods ─────────────────────────────────────────

  async generateDrillQuestions(
    topicId: number,
    providerOverride?: string | null,
    concept?: { name: string; concept_type?: string; summary?: string; key_terms?: string[] } | null
  ): Promise<DiagnosticQuestionSet> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/drill/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_override: providerOverride || null,
        concept_name: concept?.name || null,
        concept_type: concept?.concept_type || null,
        concept_summary: concept?.summary || null,
        key_terms: concept?.key_terms || null,
      }),
    });
    if (!res.ok) {
      throw await parseApiError(res);
    }
    return res.json();
  },

  async evaluateDrillAnswer(
    topicId: number,
    questionId: string,
    questionText: string,
    keyInvariants: string[],
    studentAnswer: string,
    providerOverride?: string | null,
    conceptName?: string | null,
    tier?: string | null,
    socraticHint?: string | null,
  ): Promise<DiagnosticEvaluation> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/drill/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        question_text: questionText,
        key_invariants: keyInvariants,
        student_answer: studentAnswer,
        concept_name: conceptName || null,
        tier: tier || null,
        socratic_hint: socraticHint || null,
        provider_override: providerOverride || null,
      }),
    });
    if (!res.ok) {
      throw await parseApiError(res);
    }
    return res.json();
  },

  async saveDrillFlashcards(topicId: number, flashcards: SuggestedFlashcard[]): Promise<{ status: string; saved_count: number; ids: number[] }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/drill/save-cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcards }),
    });
    await this._throwIfError(res, "Failed to save drill flashcards");
    return res.json();
  },

  async getChatHistory(topicId: number): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/api/topics/${topicId}/chat?t=${Date.now()}`, { cache: 'no-store' });
    await this._throwIfError(res, "Failed to fetch chat history");
    return res.json();
  },

  async chatWithTopic(request: ChatRequest): Promise<{ answer: string }> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw await parseApiError(res);
    }
    return res.json();
  },

  async chatWithTopicStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw await parseApiError(res);
    }

    if (!res.body) throw new Error("Stream not supported by browser.");
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n\n')) !== -1) {
          const message = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 2);
          
          if (message.startsWith("data: ")) {
            const dataStr = message.slice(6);
            if (dataStr === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error || data.message || data.error_code) {
                const errMsg = data.message || data.error || data.detail || "Chat stream error";
                const err: any = new Error(errMsg);
                err.userMessage = errMsg;
                err.errorCode = data.error_code;
                throw err;
              }
              if (data.chunk) onChunk(data.chunk);
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                if (dataStr.includes('"error"') || dataStr.includes('"message"') || dataStr.includes('"error_code"')) throw e;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  async syncPdfsStream(token: string, onEvent: (event: PdfSyncProgressEvent) => void): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sync/pdfs`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "text/event-stream",
      },
    });

    if (!res.ok) {
      throw await parseApiError(res);
    }

    if (!res.body) throw new Error("Stream not supported by browser.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n\n")) !== -1) {
          const message = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 2);

          if (message.startsWith("data: ")) {
            const dataStr = message.slice(6);
            try {
              const data = JSON.parse(dataStr);
              onEvent(data);
            } catch (e) {
              console.error("Failed to parse SSE event", e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  async getLearningDashboard(): Promise<DashboardSummaryResponse> {
    const res = await fetch(`${API_BASE}/api/v1/learning/dashboard`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getStudyActivity(range: string = '7d'): Promise<StudyActivityResponse> {
    const res = await fetch(`${API_BASE}/api/v1/learning/activity?range=${encodeURIComponent(range)}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getDocuments(limit: number = 20, offset: number = 0, status?: string): Promise<DocumentListResponse> {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/api/v1/documents?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getAccountOverview(): Promise<AccountOverviewResponse> {
    const res = await fetch(`${API_BASE}/api/v1/account/overview`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getReviewQueue(limit: number = 10, contentType?: string): Promise<ReviewQueueItem[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (contentType) params.append('content_type', contentType);
    const res = await fetch(`${API_BASE}/api/v1/reviews/queue?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async uploadDocument(file: File): Promise<DocumentUploadResponse> {
    const validationError = validateDocumentFile(file);
    if (validationError) {
      throw {
        userMessage: validationError,
        message: 'File validation failed',
        status: 413,
      };
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getDocument(documentId: string): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getDocumentStatus(documentId: string): Promise<DocumentStatusResponse> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/status`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getDocumentChunks(documentId: string, limit: number = 50, offset: number = 0): Promise<ChunkListResponse> {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/chunks?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async deleteDocument(documentId: string): Promise<{ message: string; document_id: string }> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async reindexDocument(documentId: string): Promise<ReindexResponse> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/reindex`, {
      method: 'POST',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getDocumentSummary(documentId: string, summaryType: 'short' | 'standard' | 'detailed' = 'standard'): Promise<DocumentSummaryResponse> {
    const params = new URLSearchParams({ summary_type: summaryType });
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/summary?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async generateDocumentSummary(documentId: string, summaryType: 'short' | 'standard' | 'detailed' = 'standard', force: boolean = false): Promise<DocumentSummaryResponse> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary_type: summaryType, force }),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getDocumentConcepts(documentId: string): Promise<ConceptListResponse> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/concepts`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async generateDocumentConcepts(documentId: string, maxConcepts: number = 10, force: boolean = false): Promise<ConceptListResponse> {
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_concepts: maxConcepts, force }),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getRelatedDocuments(documentId: string, limit: number = 5): Promise<RelatedDocumentsResponse> {
    const params = new URLSearchParams({ limit: limit.toString() });
    const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/related?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async listConversations(limit: number = 50, offset: number = 0): Promise<ConversationListResponse> {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    const res = await fetch(`${API_BASE}/api/v1/conversations?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async createConversation(title?: string): Promise<ConversationResponse> {
    const res = await fetch(`${API_BASE}/api/v1/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || null }),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getConversation(conversationId: string): Promise<ConversationDetailResponse> {
    const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async updateConversationTitle(conversationId: string, title: string): Promise<ConversationResponse> {
    const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async sendMessage(conversationId: string, payload: SendMessageRequest): Promise<RAGResponse> {
    const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: false }),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async sendMessageStream(
    conversationId: string,
    payload: SendMessageRequest,
    onToken: (token: string) => void,
    onDone: (event: StreamDoneEvent) => void,
    onError: (err: Error) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ ...payload, stream: true }),
      signal,
    });

    if (!res.ok) {
      throw await parseApiError(res);
    }

    if (!res.body) throw new Error('Stream not supported by browser.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawMessage = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 2);

          if (rawMessage.startsWith('data: ')) {
            const dataStr = rawMessage.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const eventData = JSON.parse(dataStr) as ChatStreamEvent;
              if (eventData.type === 'token' && typeof eventData.content === 'string') {
                onToken(eventData.content);
              } else if (eventData.type === 'done') {
                onDone(eventData);
              } else if (eventData.type === 'error') {
                onError(new Error(eventData.message || 'Generation error occurred'));
              }
            } catch (parseErr) {
              console.error('Failed to parse chat SSE event:', parseErr);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  // ── Flashcard Sets & Cards ──────────────────────────────────────

  async listFlashcardSets(limit: number = 50, offset: number = 0): Promise<FlashcardSetListResponse> {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    const res = await fetch(`${API_BASE}/api/v1/flashcards/sets?${params.toString()}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getFlashcardSet(setId: string): Promise<FlashcardSetDetailResponse> {
    const res = await fetch(`${API_BASE}/api/v1/flashcards/sets/${setId}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async updateFlashcardSet(setId: string, payload: { title?: string; description?: string }): Promise<FlashcardSetItem> {
    const res = await fetch(`${API_BASE}/api/v1/flashcards/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async deleteFlashcardSet(setId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/v1/flashcards/sets/${setId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  // ── Review Sessions (FSRS Study) ───────────────────────────────

  async startReviewSession(payload: StartReviewSessionRequest): Promise<ReviewSessionItem> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getReviewSession(sessionId: string): Promise<ReviewSessionItem> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/sessions/${sessionId}`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async getNextReviewItem(sessionId: string): Promise<MaskedReviewItem | null> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/sessions/${sessionId}/next`);
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async revealReviewItem(reviewId: string): Promise<RevealedReviewItem> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/${reviewId}/reveal`, {
      method: 'POST',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async rateReviewItem(reviewId: string, rating: ReviewRating): Promise<RateReviewResult> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/${reviewId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async completeReviewSession(sessionId: string): Promise<ReviewSessionItem> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/sessions/${sessionId}/complete`, {
      method: 'POST',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  async abandonReviewSession(sessionId: string): Promise<ReviewSessionItem> {
    const res = await fetch(`${API_BASE}/api/v1/reviews/sessions/${sessionId}/abandon`, {
      method: 'POST',
    });
    if (!res.ok) throw await parseApiError(res);
    const json = await res.json();
    return json.data;
  },

  // ─── LLM Inspection (System Prompts & Token Usage) ───
  async getPrompts(): Promise<{ prompts: SystemPrompt[] }> {
    const res = await fetch(`${API_BASE}/api/prompts`);
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  async updatePrompt(key: string, customPrompt: string): Promise<{ prompt: SystemPrompt }> {
    const res = await fetch(`${API_BASE}/api/prompts/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_prompt: customPrompt }),
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  async resetPrompt(key: string): Promise<{ prompt: SystemPrompt }> {
    const res = await fetch(`${API_BASE}/api/prompts/${key}/reset`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  async resetAllPrompts(): Promise<{ status: string; prompts: SystemPrompt[] }> {
    const res = await fetch(`${API_BASE}/api/prompts/reset-all`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  async getTokenUsageSummary(days?: number): Promise<TokenUsageSummary> {
    const url = days ? `${API_BASE}/api/token-usage/summary?days=${days}` : `${API_BASE}/api/token-usage/summary`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  async getTokenUsageHistory(limit: number = 100, offset: number = 0): Promise<{ logs: TokenLogEntry[] }> {
    const res = await fetch(`${API_BASE}/api/token-usage/history?limit=${limit}&offset=${offset}`);
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  async clearTokenUsage(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/token-usage`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },
};

export interface ReviewWorkloadStats {
  due: number;
  overdue: number;
  new: number;
  total_active: number;
}

export interface LearningStateDistribution {
  total: number;
  by_state: {
    new: number;
    learning: number;
    review: number;
    relearning: number;
    [key: string]: number;
  };
}

export interface TodayActivityStats {
  reviews_completed: number;
  quiz_attempts: number;
}

export interface QuizPerformanceStats {
  total_attempts: number;
  completed_attempts: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
  questions_answered: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy_rate: number | null;
}

export interface FlashcardPerformanceStats {
  total_cards: number;
  active_cards: number;
  cards_reviewed: number;
  cards_due: number;
  cards_in_review_state: number;
}

export interface DashboardSummaryResponse {
  review_workload: ReviewWorkloadStats;
  learning_states: LearningStateDistribution;
  today: TodayActivityStats;
  quizzes: QuizPerformanceStats;
  flashcards: FlashcardPerformanceStats;
}

export interface DailyStudyActivity {
  date: string;
  reviews_count: number;
  quiz_attempts_count: number;
  correct_answers: number;
  incorrect_answers: number;
}

export interface StudyActivityResponse {
  range: string;
  start_date: string;
  end_date: string;
  total_active_days: number;
  total_reviews: number;
  total_quiz_attempts: number;
  activity: DailyStudyActivity[];
}

export interface DocumentItem {
  id: string;
  workspace_id: string;
  file_id?: string | null;
  title: string;
  source_type: string;
  total_pages: number;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | string;
  processing_error?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  total: number;
  limit: number;
  offset: number;
  documents: DocumentItem[];
}

export interface UsageMetricItem {
  used: number;
  limit: number;
  remaining: number;
  reset_at?: string | null;
}

export interface UsageSummaryResponse {
  ai_credits: UsageMetricItem;
  documents: UsageMetricItem;
  storage_mb: UsageMetricItem;
}

export interface BYOKStatusResponse {
  enabled: boolean;
  has_configured_providers: boolean;
  configured_providers: string[];
}

export interface PlanInfo {
  id: string;
  name: string;
  price_cents: number;
  billing_interval: string;
}

export interface AccountOverviewResponse {
  plan: PlanInfo;
  limits: {
    monthly_credits: number;
    max_documents: number;
    max_storage_mb: number;
    byok_allowed: boolean;
    [key: string]: any;
  };
  subscription?: any | null;
  features: Record<string, boolean>;
  usage: UsageSummaryResponse;
  byok: BYOKStatusResponse;
}

export interface ReviewQueueItem {
  id: string;
  content_type: string;
  content_id: string;
  priority_group: string;
  next_review_at?: string | null;
  front?: string | null;
  source_reference?: Record<string, any>;
}

export interface DocumentUploadResponse {
  document_id: string;
  job_id: string;
  status: string;
  filename: string;
  size_bytes: number;
  book_id?: number;
}

export interface DocumentStatusResponse {
  document_id: string;
  status: string;
  current_stage?: string | null;
  stage_progress: number;
  error_code?: string | null;
  error_message?: string | null;
  attempt_count: number;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ChunkItemResponse {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number | null;
  token_count: number;
  embedding_model?: string;
  created_at: string;
}

export interface ChunkListResponse {
  total: number;
  limit: number;
  offset: number;
  chunks: ChunkItemResponse[];
}

export interface SourceReference {
  source_index: number;
  chunk_id?: string | null;
  document_id?: string | null;
  document_title?: string | null;
  page_number?: number | null;
  snippet?: string | null;
}

export interface DocumentSummaryResponse {
  id: string;
  document_id: string;
  summary_type: 'short' | 'standard' | 'detailed' | string;
  summary: string;
  key_points: string[];
  source_references: SourceReference[];
  content_version: string;
  is_stale: boolean;
  model_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConceptItemResponse {
  id: string;
  document_id: string;
  name: string;
  normalized_name: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  source_references: SourceReference[];
  content_version: string;
  created_at: string;
}

export interface ConceptListResponse {
  document_id: string;
  concepts: ConceptItemResponse[];
  total: number;
  content_version: string;
}

export interface RelatedDocumentItem {
  id: string;
  title: string;
  source_type: string;
  similarity_score: number;
}

export interface RelatedDocumentsResponse {
  document_id: string;
  related_documents: RelatedDocumentItem[];
}

export interface ReindexResponse {
  document_id: string;
  job_id: string;
  status: string;
}

export interface ConversationResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SourceCitation {
  source_index: number;
  document_id: string;
  document_title: string;
  chunk_id: string;
  page_number?: number | null;
  score?: number | null;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  sources: SourceCitation[];
  token_count: number;
  created_at: string;
}

export interface ConversationDetailResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: MessageResponse[];
}

export interface ConversationListResponse {
  conversations: ConversationResponse[];
  total: number;
}

export interface SendMessageRequest {
  content: string;
  document_id?: string | null;
  provider?: string | null;
  stream?: boolean;
}

export interface RAGResponse {
  message: MessageResponse;
  conversation_title: string;
  credits_remaining?: number | null;
  is_byok: boolean;
  provider: string;
  model: string;
}

export interface StreamTokenEvent {
  type: 'token';
  content: string;
}

export interface StreamDoneEvent {
  type: 'done';
  message_id: string;
  conversation_title: string;
  sources: SourceCitation[];
  credits_remaining?: number | null;
  provider: string;
  model: string;
  is_byok: boolean;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export type ChatStreamEvent = StreamTokenEvent | StreamDoneEvent | StreamErrorEvent;

// ── Flashcard Set & Card Interfaces ───────────────────────────────

export interface FlashcardSetItem {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  source_document_ids: string[];
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface FlashcardSetListResponse {
  sets: FlashcardSetItem[];
  total: number;
}

export interface FlashcardItem {
  id: string;
  flashcard_set_id: string;
  front: string;
  back: string;
  source_metadata: Array<Record<string, any>>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FlashcardSetDetailResponse extends FlashcardSetItem {
  cards: FlashcardItem[];
}

export interface FlashcardGenerateRequest {
  document_ids?: string[] | null;
  title?: string | null;
  topic?: string | null;
  count?: number;
  provider?: string | null;
}

// ── Review Session & FSRS Study Interfaces ────────────────────────

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface StartReviewSessionRequest {
  limit?: number;
  content_type?: string | null;
}

export interface ReviewSessionItem {
  id: string;
  workspace_id: string;
  user_id: string;
  status: string;
  started_at: string;
  completed_at?: string | null;
  total_items: number;
  reviewed_items: number;
  progress_percentage: number;
}

export interface MaskedReviewItem {
  review_id: string;
  session_id: string;
  learning_item_id: string;
  content_type: string;
  content_id: string;
  front: string;
  options?: string[] | null;
  source_metadata?: Array<Record<string, any>> | null;
  order_index: number;
  status: string;
  revealed: boolean;
}

export interface RevealedReviewItem extends MaskedReviewItem {
  back: string;
  explanation?: string | null;
  revealed: true;
}

export interface RateReviewResult {
  review_id: string;
  session_id: string;
  learning_item_id: string;
  rating: string;
  next_review_at: string;
  stability?: number | null;
  difficulty?: number | null;
  state: string;
  reviewed_items: number;
  total_items: number;
  session_status: string;
}
