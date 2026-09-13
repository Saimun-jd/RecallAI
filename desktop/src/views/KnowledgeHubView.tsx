import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MessageSquare, Plus, RotateCcw, AlertCircle, 
  Menu, PanelLeftOpen 
} from 'lucide-react';
import { 
  client, 
  type ConversationResponse, 
  type MessageResponse, 
  type SourceCitation 
} from '../api/client';
import { 
  ConversationSidebar, 
  KnowledgeScopeSelector, 
  ChatMessageItem, 
  ChatComposer, 
  ChatEmptyState, 
  SourcePreviewModal, 
  UsageLimitBanner 
} from '../components/chat';
import { useToast } from '../hooks/useToast';

export function KnowledgeHubView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // Conversation list & active state
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Scope state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentTitle, setSelectedDocumentTitle] = useState<string | null>(null);
  const [hasDocuments, setHasDocuments] = useState(true);

  // Chat interaction & streaming
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [usageLimitMessage, setUsageLimitMessage] = useState<string | null>(null);
  const [inspectedCitation, setInspectedCitation] = useState<SourceCitation | null>(null);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string>('');

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Initial Data Fetching: Check documents & load conversation list
  const loadInitialData = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const [docsResp, convResp] = await Promise.all([
        client.getDocuments(1, 0),
        client.listConversations(50, 0),
      ]);

      setHasDocuments(docsResp.total > 0);
      setConversations(convResp.conversations || []);

      // Check URL query parameters
      const urlDocId = searchParams.get('document_id');
      const urlConvId = searchParams.get('conversation_id');

      if (urlDocId) {
        setSelectedDocumentId(urlDocId);
        try {
          const doc = await client.getDocument(urlDocId);
          setSelectedDocumentTitle(doc.title);
        } catch {
          setSelectedDocumentTitle('Selected Document');
        }
      }

      if (urlConvId) {
        setActiveConversationId(urlConvId);
      }
    } catch (err: any) {
      console.error('Failed to load Knowledge Hub initial data:', err);
      showToast('error', err?.userMessage || 'Failed to connect to Knowledge Hub.');
    } finally {
      setLoadingConversations(false);
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load message history when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchConversationDetails = async () => {
      setLoadingMessages(true);
      setActiveError(null);
      try {
        const detail = await client.getConversation(activeConversationId);
        if (isMounted) {
          setMessages(detail.messages || []);
          // Update URL
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('conversation_id', activeConversationId);
            return next;
          }, { replace: true });
        }
      } catch (err: any) {
        console.error('Failed to load conversation messages:', err);
        if (isMounted) {
          setActiveError('Failed to load message history. The conversation may have been removed.');
        }
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    fetchConversationDetails();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId, setSearchParams]);

  // Select scope handler
  const handleSelectScope = (docId: string | null, docTitle?: string) => {
    setSelectedDocumentId(docId);
    setSelectedDocumentTitle(docTitle || null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (docId) {
        next.set('document_id', docId);
      } else {
        next.delete('document_id');
      }
      return next;
    }, { replace: true });
  };

  // Start fresh conversation session
  const handleNewChat = () => {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    setActiveConversationId(null);
    setMessages([]);
    setActiveError(null);
    setInput('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('conversation_id');
      return next;
    }, { replace: true });
  };

  // Inline Rename conversation title
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await client.updateConversationTitle(id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      );
      showToast('success', 'Conversation renamed.');
    } catch (err: any) {
      console.error('Rename conversation error:', err);
      showToast('error', err?.userMessage || 'Failed to update conversation title.');
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await client.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        handleNewChat();
      }
      showToast('success', 'Conversation deleted.');
    } catch (err: any) {
      console.error('Delete conversation error:', err);
      showToast('error', err?.userMessage || 'Failed to delete conversation.');
    }
  };

  // Stop active streaming generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    showToast('info', 'Generation stopped.');
  };

  // Send message and stream grounded RAG response
  const handleSendMessage = async (queryOverride?: string) => {
    const query = (queryOverride || input).trim();
    if (!query || isStreaming) return;

    lastQueryRef.current = query;
    setActiveError(null);
    setUsageLimitMessage(null);

    let targetConvId = activeConversationId;

    // Lazy conversation creation if starting fresh
    if (!targetConvId) {
      try {
        const newConv = await client.createConversation();
        targetConvId = newConv.id;
        setActiveConversationId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('conversation_id', newConv.id);
          return next;
        }, { replace: true });
      } catch (err: any) {
        console.error('Failed to create conversation session:', err);
        showToast('error', err?.userMessage || 'Failed to initialize chat session.');
        return;
      }
    }

    // Append user message optimistically
    const userMsg: MessageResponse = {
      id: `user-${Date.now()}`,
      conversation_id: targetConvId,
      role: 'user',
      content: query,
      sources: [],
      token_count: Math.ceil(query.length / 4),
      created_at: new Date().toISOString(),
    };

    // Append placeholder assistant message
    const tempAssistantId = `assistant-stream-${Date.now()}`;
    const assistantMsgPlaceholder: MessageResponse = {
      id: tempAssistantId,
      conversation_id: targetConvId,
      role: 'assistant',
      content: '',
      sources: [],
      token_count: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder]);
    setInput('');
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await client.sendMessageStream(
        targetConvId,
        {
          content: query,
          document_id: selectedDocumentId || null,
          stream: true,
        },
        // onToken: update accumulated content
        (token: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },
        // onDone: attach validated sources and finalize
        (doneEvent) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? {
                    ...msg,
                    id: doneEvent.message_id || msg.id,
                    sources: doneEvent.sources || [],
                  }
                : msg
            )
          );

          // Update conversation title in list if auto-titled by backend
          if (doneEvent.conversation_title) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === targetConvId
                  ? { ...c, title: doneEvent.conversation_title, updated_at: new Date().toISOString() }
                  : c
              )
            );
          }

          // Check credit warning
          if (
            doneEvent.credits_remaining !== null &&
            doneEvent.credits_remaining !== undefined &&
            doneEvent.credits_remaining <= 0 &&
            !doneEvent.is_byok
          ) {
            setUsageLimitMessage("You've used all allocated AI credits for this billing period.");
          }
        },
        // onError: handle stream error
        (streamErr) => {
          console.error('SSE chat error:', streamErr);
          const errMessage = streamErr.message || 'Error occurred during generation.';
          if (errMessage.toLowerCase().includes('limit') || errMessage.toLowerCase().includes('quota')) {
            setUsageLimitMessage(errMessage);
          } else {
            setActiveError(errMessage);
          }
        },
        abortController.signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      console.error('Chat error:', err);
      const errMsg = err?.userMessage || err?.message || 'Failed to complete question.';
      if (err?.statusCode === 429 || errMsg.toLowerCase().includes('limit') || errMsg.toLowerCase().includes('quota')) {
        setUsageLimitMessage(errMsg);
      } else {
        setActiveError(errMsg);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Retry last question
  const handleRetry = () => {
    if (lastQueryRef.current) {
      handleSendMessage(lastQueryRef.current);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex-1 flex flex-row h-full overflow-hidden bg-background">
      {/* ── Left Sidebar: Conversation History ── */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        loading={loadingConversations}
        isMobileDrawerOpen={isMobileHistoryOpen}
        onCloseMobileDrawer={() => setIsMobileHistoryOpen(false)}
      />

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-background overflow-hidden relative">
        {/* Knowledge Hub Header Toolbar */}
        <div className="h-14 px-3.5 sm:px-6 border-b-2 border-border-default bg-surface/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile History Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileHistoryOpen(true)}
              className="md:hidden p-1.5 rounded-lg border border-border-default bg-surface hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
              title="Open Chat Sessions"
              aria-label="Open conversation history"
            >
              <PanelLeftOpen size={16} />
            </button>

            {/* Current Conversation Title & Identity */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <MessageSquare size={13} />
              </div>
              <h1 className="font-black text-xs sm:text-sm text-on-surface truncate max-w-[150px] sm:max-w-xs md:max-w-md">
                {activeConversation ? activeConversation.title : 'New Dialogue'}
              </h1>
            </div>
          </div>

          {/* Scope Selector & Quick New Chat */}
          <div className="flex items-center gap-2 shrink-0">
            <KnowledgeScopeSelector
              selectedDocumentId={selectedDocumentId}
              onSelectScope={handleSelectScope}
            />

            <button
              type="button"
              onClick={handleNewChat}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface shadow-neo-sm hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] text-xs font-bold transition-all cursor-pointer"
              title="Start a new conversation"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Usage Limit Banner (if quota exceeded) */}
        {usageLimitMessage && (
          <div className="p-3 sm:px-6 shrink-0 bg-surface border-b-2 border-border-default animate-in slide-in-from-top-2 duration-150">
            <UsageLimitBanner
              message={usageLimitMessage}
              onDismiss={() => setUsageLimitMessage(null)}
            />
          </div>
        )}

        {/* Message Stream Viewport */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 custom-scrollbar">
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-2 text-xs font-bold">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Retrieving grounded conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <ChatEmptyState
              selectedDocumentTitle={selectedDocumentTitle}
              hasDocuments={hasDocuments}
              onSelectPrompt={(prompt) => {
                setInput(prompt);
                handleSendMessage(prompt);
              }}
            />
          ) : (
            messages.map((msg, idx) => {
              const isLastMessage = idx === messages.length - 1;
              return (
                <ChatMessageItem
                  key={msg.id || idx}
                  message={msg}
                  isStreaming={isStreaming && isLastMessage && msg.role === 'assistant'}
                  onInspectCitation={(citation) => setInspectedCitation(citation)}
                />
              );
            })
          )}

          {/* Active Error Banner with Retry */}
          {activeError && (
            <div className="p-4 rounded-xl border-2 border-error/40 bg-error/10 text-error flex items-center justify-between gap-3 shadow-neo-sm animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 text-xs font-bold min-w-0">
                <AlertCircle size={16} className="shrink-0" />
                <span className="truncate">{activeError}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error text-white text-xs font-bold hover:bg-error/90 transition-colors shrink-0 cursor-pointer shadow-2xs"
              >
                <RotateCcw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer Row (Sticky Bottom) */}
        <div className="p-3 sm:p-4 border-t-2 border-border-default bg-surface/95 backdrop-blur-md shrink-0">
          <ChatComposer
            input={input}
            setInput={setInput}
            onSend={() => handleSendMessage()}
            onStop={handleStopGeneration}
            isStreaming={isStreaming}
            disabled={!hasDocuments || loadingMessages}
            selectedDocumentTitle={selectedDocumentTitle}
          />
        </div>
      </div>

      {/* Grounding Source Preview Modal */}
      <SourcePreviewModal
        isOpen={!!inspectedCitation}
        citation={inspectedCitation}
        onClose={() => setInspectedCitation(null)}
      />
    </div>
  );
}
