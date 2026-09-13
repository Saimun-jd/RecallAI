import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { X, Bot, Send, User, Loader2, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ExamTopicCardList } from './ExamTopicCardList';
import { client, type ChatMessage, type ExamTopicItem } from '../api/client';
import clsx from 'clsx';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  topicId?: number;
  bookId?: number;
  contextMarkdown?: string;
  topicName?: string;
  isProcessing?: boolean;
  onProcessTopic?: () => void;
  onPracticeTopic?: (topicId: number, topicName: string) => void;
  onPracticeExamScope?: (topicIds: number[]) => void;
}

interface ParsedMessagePart {
  type: 'markdown' | 'exam-topics';
  content: string;
  topics?: ExamTopicItem[];
}

function parseMessageContent(raw: string): ParsedMessagePart[] {
  // If raw contains an incomplete :::exam-topics block currently streaming
  const openIndex = raw.indexOf(':::exam-topics');
  if (openIndex !== -1 && !raw.slice(openIndex + 14).includes(':::')) {
    const parts: ParsedMessagePart[] = [];
    const before = raw.slice(0, openIndex).trim();
    if (before) {
      parts.push({ type: 'markdown', content: before });
    }
    parts.push({
      type: 'markdown',
      content: '_Analyzing slide deck & matching exam topics..._',
    });
    return parts;
  }

  const directiveRegex = /:::exam-topics\s*([\s\S]*?)\s*:::/g;
  const parts: ParsedMessagePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = directiveRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push({ type: 'markdown', content: text });
      }
    }

    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parts.push({
          type: 'exam-topics',
          content: match[0],
          topics: parsed,
        });
      } else {
        parts.push({ type: 'markdown', content: match[0] });
      }
    } catch {
      parts.push({ type: 'markdown', content: match[0] });
    }

    lastIndex = directiveRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex);
    if (text.trim() || parts.length === 0) {
      parts.push({ type: 'markdown', content: text });
    }
  }

  return parts;
}

export function AIChatSidebar({
  isOpen,
  onClose,
  isExpanded: controlledExpanded,
  onToggleExpand,
  topicId,
  bookId,
  contextMarkdown,
  topicName,
  isProcessing,
  onProcessTopic,
  onPracticeTopic,
  onPracticeExamScope,
}: AIChatSidebarProps) {
  const { activeProvider, configuredProviders } = useSelector((state: RootState) => state.providers);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpand = onToggleExpand || (() => setInternalExpanded(prev => !prev));

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: `Hello! I am Onizuka Sensei. I see you are studying ${topicName ? `**${topicName}**` : 'this topic'}. Ask me any doubts you have about it!` }
  ]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<string>(() => {
    return localStorage.getItem('chat_provider_override') || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevTopicRef = useRef(topicId);

  // Keyboard shortcut: Escape exits full screen
  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleExpand();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded, toggleExpand]);

  // Persist provider
  useEffect(() => {
    localStorage.setItem('chat_provider_override', provider);
  }, [provider]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history if topic changes
  useEffect(() => {
    let isMounted = true;

    // We only want to trigger this when the topicId genuinely changes
    // But we also want to run it once on initial mount if topicId exists
    // The dependency array [topicId] handles both.

    // However, since we want to avoid double-loading, we check prevTopicRef
    if (prevTopicRef.current !== topicId || messages.length === 1) { // messages.length === 1 means only the default greeting is there
      prevTopicRef.current = topicId;

      const loadHistory = async () => {
        if (topicId) {
          try {
            const history = await client.getChatHistory(topicId);
            if (history && history.length > 0 && isMounted) {
              setMessages(history);
              return;
            }
          } catch (e) {
            console.error('Failed to load chat history from DB', e);
          }
        }
        if (isMounted) {
          setMessages([
            { role: 'ai', content: `Hello! I am Onizuka Sensei. I see you are studying ${topicName ? `**${topicName}**` : 'this topic'}. Ask me any doubts you have about it!` }
          ]);
        }
      };

      loadHistory();
    }

    return () => { isMounted = false; };
  }, [topicId]);

  const askQuestion = async (userMsg: string, currentMessages: ChatMessage[], markdown: string) => {
    if (!topicId && !bookId) return;
    setIsLoading(true);

    // Add empty placeholder for the AI response
    setMessages(prev => {
      const filtered = prev.filter(m => m.content !== 'please wait i am processing the topic...');
      return [...filtered, { role: 'ai', content: '' }];
    });

    try {
      await client.chatWithTopicStream({
        topic_id: topicId,
        book_id: bookId,
        topic_name: topicName,
        context_markdown: markdown,
        question: userMsg,
        history: currentMessages,
        provider_override: provider || null,
      }, (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex].role === 'ai') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: updated[lastIndex].content + chunk
            };
          }
          return updated;
        });
      });
    } catch (err: any) {
      console.error(err);
      setMessages(prev => {
        // Remove the empty or partial AI message on error
        const filtered = prev.filter((m, i) => !(m.role === 'ai' && i === prev.length - 1 && m.content === ''));
        return [...filtered, { role: 'system', content: `**Error:** ${err?.userMessage || err?.message || 'Failed to get response'}` }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // We no longer need pendingQuestion since askQuestion is called directly.

  const chosenProvider = (provider || activeProvider) as keyof typeof configuredProviders;
  const isKeyMissing = chosenProvider !== 'ollama' && !configuredProviders[chosenProvider];

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading || isProcessing) return;

    const userMsg = input.trim();

    if (isKeyMissing) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMsg },
        { role: 'system', content: `**Configuration Needed:** No API key is configured for **${chosenProvider.toUpperCase()}**. Please add your ${chosenProvider.toUpperCase()} API key in **Settings → API Keys**.` }
      ]);
      setInput('');
      return;
    }

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInput('');

    await askQuestion(userMsg, newMessages, contextMarkdown || '');

    // If contextMarkdown was missing, the backend extracted it during chat.
    // Notify BookDetailView to re-fetch the topic so Notes tab updates immediately!
    if (!contextMarkdown && onProcessTopic) {
      onProcessTopic();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={clsx(
      "bg-surface border-2 border-on-surface rounded-2xl flex flex-col overflow-hidden transition-all duration-200",
      isExpanded
        ? "w-full h-full max-w-6xl mx-auto shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
        : "w-[420px] h-[calc(100vh-176px)] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in fade-in slide-in-from-right-4 duration-200"
    )}>

      {/* Header */}
      <div className="bg-primary px-3.5 py-3 border-b-2 border-on-surface flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 text-white min-w-0 flex-1">
          <Bot size={20} strokeWidth={2.5} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm tracking-tight leading-none uppercase truncate">Onizuka Sensei</h3>
            <p
              className="text-[10px] text-white/80 font-bold tracking-wider mt-0.5 truncate block w-full"
              title={topicName || 'Document AI Assistant'}
            >
              {topicName ? topicName : 'Document AI Assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Provider Selector */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-surface text-on-surface text-xs font-bold px-2 py-1 rounded border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none cursor-pointer max-w-[120px] truncate shrink-0"
            title="Select AI Provider"
          >
            <option value="">Default Provider</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <option value="groq">Groq</option>
          </select>
          <button
            onClick={toggleExpand}
            className="text-white hover:bg-black/20 rounded p-1 transition-colors cursor-pointer shrink-0"
            title={isExpanded ? "Exit full screen (Esc)" : "Full screen"}
          >
            {isExpanded ? <Minimize2 size={18} strokeWidth={2.5} /> : <Maximize2 size={18} strokeWidth={2.5} />}
          </button>
          <button
            onClick={onClose}
            className="text-white hover:bg-black/20 rounded p-1 transition-colors cursor-pointer shrink-0"
            title="Close chat"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Missing Key Warning Banner */}
      {isKeyMissing && (
        <div className="bg-amber-100 border-b-2 border-amber-400 px-4 py-2 flex items-center gap-2 text-amber-900 text-xs font-bold shrink-0 animate-in fade-in">
          <AlertTriangle size={14} className="text-amber-700 shrink-0" />
          <span>{chosenProvider.toUpperCase()} API key missing. Add in Settings → API Keys.</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto flex flex-col bg-surface custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={clsx(
            "flex flex-col gap-3 px-5 py-6 border-b-2 border-on-surface/5",
            msg.role === 'user' ? "bg-surface" : "bg-surface-container-lowest"
          )}>
            <div className={clsx("flex flex-col gap-3 w-full", isExpanded && "max-w-4xl mx-auto")}>
              {/* Header: Avatar + Name */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <User size={16} strokeWidth={2.5} />
                    </div>
                  ) : (
                    <img
                      src="/onizuka.jpeg"
                      alt="Onizuka"
                      className="w-8 h-8 rounded border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white object-cover"
                    />
                  )}
                </div>
                <div className="font-black text-xs text-on-surface uppercase tracking-wider opacity-80">
                  {msg.role === 'user' ? 'You' : 'Onizuka'}
                </div>
              </div>

              {/* Content */}
              <div className="text-sm prose prose-sm prose-p:leading-relaxed max-w-full overflow-x-auto text-on-surface prose-pre:my-3 prose-pre:border-2 prose-pre:border-on-surface prose-pre:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : isLoading && idx === messages.length - 1 && !msg.content ? (
                  <div className="flex items-center gap-2 text-primary italic py-2 font-medium">
                    <Loader2 size={16} className="animate-spin" />
                    Thinking...
                  </div>
                ) : (
                  <div className="relative space-y-2">
                    {parseMessageContent(msg.content).map((part, pIdx) => {
                      if (part.type === 'exam-topics' && part.topics) {
                        return (
                          <div key={pIdx} className="not-prose">
                            <ExamTopicCardList
                              topics={part.topics}
                              onPracticeTopic={onPracticeTopic}
                              onPracticeExamScope={onPracticeExamScope}
                            />
                          </div>
                        );
                      }
                      return (
                        <MarkdownRenderer key={pIdx} content={part.content} />
                      );
                    })}
                    {isLoading && idx === messages.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle mt-1" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface shrink-0 border-t-2 border-on-surface/10">
        <div className={clsx(
          "flex items-center bg-surface-container-lowest border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus-within:border-primary transition-colors",
          isExpanded && "max-w-4xl mx-auto"
        )}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            rows={1}
            placeholder={isProcessing ? "Processing topic..." : "Ask Onizuka sensei a question..."}
            className="flex-1 bg-transparent border-none pl-4 py-3 text-sm resize-none max-h-32 focus:outline-none focus:ring-0 custom-scrollbar text-on-surface disabled:opacity-50 disabled:cursor-not-allowed my-auto"
          />
          <div className="p-2 shrink-0">
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isProcessing}
              className="w-8 h-8 bg-primary text-white rounded-lg border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-blue transition-colors active:translate-y-px active:shadow-none flex items-center justify-center"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
        <p className={clsx(
          "text-[10px] text-on-surface-variant text-center mt-3 font-bold uppercase tracking-widest",
          isExpanded && "max-w-4xl mx-auto"
        )}>
          Onizuka can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
