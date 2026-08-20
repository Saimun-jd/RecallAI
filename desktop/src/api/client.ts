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
  content_md?: string;
  mastery_score?: number | null;
  mastery_status?: 'untested' | 'mastered' | 'developing' | 'fragile' | 'misconception';
  last_drilled_at?: string | null;
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
  questions: DiagnosticQuestion[];
}

export interface SuggestedFlashcard {
  question: string;
  answer: string;
  gap_source: string;
}

export interface DiagnosticEvaluation {
  mastery_score: number;
  status: 'mastered' | 'developing' | 'fragile' | 'misconception';
  strengths: string[];
  diagnosed_gaps: string[];
  misconceptions: string[];
  socratic_nudge: string | null;
  suggested_flashcards: SuggestedFlashcard[];
}

export const client = {
  async getBooks(): Promise<Book[]> {
    const res = await fetch(`${API_BASE}/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    return res.json();
  },
  async getBook(id: number): Promise<Book> {
    const res = await fetch(`${API_BASE}/books/${id}`);
    if (!res.ok) throw new Error("Failed to fetch book");
    return res.json();
  },
  async deleteBook(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/books/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete book");
    return res.json();
  },
  async getTopics(bookId?: number): Promise<Topic[]> {
    const url = bookId ? `${API_BASE}/topics?book_id=${bookId}` : `${API_BASE}/topics`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch topics");
    return res.json();
  },
  async getTopic(id: number): Promise<Topic> {
    const res = await fetch(`${API_BASE}/topics/${id}`);
    if (!res.ok) throw new Error("Failed to fetch topic");
    return res.json();
  },
  async getFlashcard(id: number): Promise<Flashcard> {
    const res = await fetch(`${API_BASE}/flashcards/${id}`);
    if (!res.ok) throw new Error("Failed to fetch flashcard");
    return res.json();
  },
  async updateFlashcard(id: number, data: { question: string; answer: string }): Promise<{ message: string; flashcard_id: number }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update flashcard");
    return res.json();
  },
  async deleteFlashcard(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete flashcard");
    return res.json();
  },
  async getSettings(): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error("Failed to fetch settings");
    return res.json();
  },
  async updateSetting(key: string, value: string): Promise<{ status: string; key: string; value: string }> {
    const res = await fetch(`${API_BASE}/settings/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error("Failed to update setting");
    return res.json();
  },
  async saveApiKeys(keys: { gemini_api_key?: string, groq_api_key?: string, openai_api_key?: string, langfuse_secret_key?: string, langfuse_public_key?: string, langfuse_host?: string }): Promise<{ status: string }> {
    try {
      const res = await fetch(`${API_BASE}/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys),
      });
      if (!res.ok) throw new Error("Failed to save API keys to backend");
      return res.json();
    } catch (error: any) {
      if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
        throw new Error("Backend HTTP sync failed. The Python sidecar might be offline.");
      }
      throw error;
    }
  },
  async resetFlashcard(id: number): Promise<{ message: string; flashcard_id: number }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}/reset`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to reset flashcard");
    return res.json();
  },
  async getDueCards(limit: number = 20): Promise<Flashcard[]> {
    const res = await fetch(`${API_BASE}/flashcards/due?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch due cards");
    return res.json();
  },
  async submitReview(id: number, rating: number): Promise<{ message: string; next_due: string }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    if (!res.ok) throw new Error("Failed to submit review");
    return res.json();
  },
  async undoReview(id: number): Promise<{ message: string; flashcard_id: number }> {
    const res = await fetch(`${API_BASE}/flashcards/${id}/undo-review`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to undo review");
    return res.json();
  },
  async searchAll(query: string, limit: number = 20): Promise<Array<{ type: string; id: number; title: string; subtitle: string }>> {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  },
  async getAnalytics(): Promise<AnalyticsStats> {
    const res = await fetch(`${API_BASE}/analytics/stats`);
    if (!res.ok) throw new Error("Failed to fetch analytics");
    return res.json();
  },
  async checkHealth(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Backend not healthy");
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
    if (!res.ok) throw new Error("Failed to upload book");
    return res.json();
  },
  
  async processTopicStream(topicId: number, activeProvider: string, onEvent: (event: any) => void): Promise<void> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/process-stream`, {
      method: "POST",
      headers: { "Accept": "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ provider_override: activeProvider })
    });
    
    if (!res.ok) throw new Error("Failed to start processing");
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
              onProgress(data);
              if (data.status === 'complete' || data.status === 'error' || data.stage === 'complete' || data.stage === 'error') {
                finishedCleanly = true;
              }
            } catch (e) {
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
    
    if (!res.ok) throw new Error("Failed to start processing");
    
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
              if (data.status === 'complete' || data.status === 'error') {
                finishedCleanly = true;
              }
            } catch (e) {
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
    if (!res.ok) throw new Error("Failed to fetch note");
    return res.json();
  },
  
  async updateNote(topicId: number, note: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error("Failed to update note");
    return res.json();
  },
  
  async getTopicFlashcards(topicId?: number): Promise<Flashcard[]> {
    const url = topicId ? `${API_BASE}/flashcards?topic_id=${topicId}` : `${API_BASE}/flashcards`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch flashcards");
    return res.json();
  },
  
  async getRelatedTopics(topicId: number, limit: number = 5): Promise<RelatedTopic[]> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/related?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch related topics");
    return res.json();
  },
  
  async generateFlashcards(topicId: number, options: { count: number; custom_prompt?: string, provider_override?: string }): Promise<{ flashcards: Flashcard[] }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error("Failed to generate flashcards");
    return res.json();
  },

  // ─── PDF Annotation API ───

  async getAnnotations(bookId: number, pageNumber?: number): Promise<PdfAnnotation[]> {
    const url = pageNumber !== undefined
      ? `${API_BASE}/books/${bookId}/annotations?page=${pageNumber}`
      : `${API_BASE}/books/${bookId}/annotations`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch annotations");
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
    if (!res.ok) throw new Error("Failed to create annotation");
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
    if (!res.ok) throw new Error("AI explanation failed");
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
    if (!res.ok) throw new Error("Flashcard generation from selection failed");
    return res.json();
  },

  async updateAnnotation(annotationId: number, content: string): Promise<void> {
    const res = await fetch(`${API_BASE}/annotations/${annotationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to update annotation");
  },

  async deleteAnnotation(annotationId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/annotations/${annotationId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete annotation");
  },

  // ── Socratic Drill Methods ─────────────────────────────────────────

  async generateDrillQuestions(topicId: number, providerOverride?: string | null): Promise<DiagnosticQuestionSet> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/drill/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_override: providerOverride || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || "Failed to generate drill questions");
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
  ): Promise<DiagnosticEvaluation> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/drill/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        question_text: questionText,
        key_invariants: keyInvariants,
        student_answer: studentAnswer,
        provider_override: providerOverride || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || "Failed to evaluate answer");
    }
    return res.json();
  },

  async saveDrillFlashcards(topicId: number, flashcards: SuggestedFlashcard[]): Promise<{ status: string; saved_count: number; ids: number[] }> {
    const res = await fetch(`${API_BASE}/topics/${topicId}/drill/save-cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcards }),
    });
    if (!res.ok) throw new Error("Failed to save drill flashcards");
    return res.json();
  },
};
