import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { parseApiError, parseSSEError, type ApiError } from './errors';

const fetch = async (url: string, options?: any) => {
  const res = await tauriFetch(url, options);
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

export const API_BASE = "http://127.0.0.1:8000";

export interface Book {
  id: number;
  title: string;
  file_path: string;
  file_hash: string;
  total_pages: number;
  created_at: string;
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

export interface DiagnosticEvaluation {
  concept_name?: string | null;
  mastery_score: number;
  status: 'mastered' | 'developing' | 'fragile' | 'misconception';
  strengths: string[];
  diagnosed_gaps: string[];
  misconceptions: string[];
  socratic_nudge: string | null;
  suggested_flashcards: SuggestedFlashcard[];
}

export interface ChatMessage {
  role: 'user' | 'ai' | 'system' | 'assistant';
  content: string;
}

export interface ChatRequest {
  topic_id: number;
  topic_name?: string;
  context_markdown: string;
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
  async updateFlashcard(id: number, data: { question: string; answer: string }): Promise<{ message: string; flashcard_id: number }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await this._throwIfError(res, "Failed to update flashcard");
    return res.json();
  },
  async deleteFlashcard(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}`, { method: "DELETE" });
    await this._throwIfError(res, "Failed to delete flashcard");
    return res.json();
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
  async saveApiKeys(keys: { gemini_api_key?: string, groq_api_key?: string, openai_api_key?: string, langfuse_secret_key?: string, langfuse_public_key?: string, langfuse_host?: string, ollama_host?: string }): Promise<{ status: string }> {
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
  async uploadPdfAndGetToc(file: File, bookTitle: string, totalPages: number): Promise<UploadResponse> {
    const fileHash = await Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
      .map(b => b.toString(16).padStart(2, "0")).join("");
      
    const formData = new FormData();
    formData.append("file", file);
    formData.append("book_title", bookTitle);
    formData.append("file_hash", fileHash);
    formData.append("total_pages", totalPages.toString());
    
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

  async generateNoteScaffold(topicId: number, providerOverride?: string | null): Promise<{ topic_id: number; scaffold: string; note: string }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes/scaffold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_override: providerOverride || null }),
    });
    await this._throwIfError(res, "Failed to generate note scaffold");
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
  
  async generateFlashcards(topicId: number, options: { count: number; custom_prompt?: string, provider_override?: string }): Promise<{ flashcards: Flashcard[] }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      throw await parseApiError(res);
    }
    return res.json();
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
              if (data.error) throw new Error(data.error);
              if (data.chunk) onChunk(data.chunk);
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                if (dataStr.includes('"error":')) throw e;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
