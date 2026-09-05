import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Send, User, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { client, type ChatMessage } from '../api/client';
import clsx from 'clsx';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  topicId?: number;
  contextMarkdown?: string;
  topicName?: string;
  isProcessing?: boolean;
  onProcessTopic?: () => void;
}

export function AIChatSidebar({ isOpen, onClose, topicId, contextMarkdown, topicName, isProcessing, onProcessTopic }: AIChatSidebarProps) {
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
    if (!topicId) return;
    setIsLoading(true);

    // Add empty placeholder for the AI response
    setMessages(prev => {
      const filtered = prev.filter(m => m.content !== 'please wait i am processing the topic...');
      return [...filtered, { role: 'ai', content: '' }];
    });

    try {
      await client.chatWithTopicStream({
        topic_id: topicId,
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

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading || isProcessing) return;

    const userMsg = input.trim();
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInput('');

    await askQuestion(userMsg, newMessages, contextMarkdown || '');

    // If contextMarkdown was missing, the backend extracted it during chat.
    // We can call onProcessTopic to refresh the parent's topics state if needed.
    if (!contextMarkdown && onProcessTopic) {
      // Just call this to trigger a refresh of the topics list in the parent
      // since the backend just generated the markdown for this topic.
      onProcessTopic();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="absolute top-4 right-4 bottom-4 w-[450px] bg-surface-container-lowest border-2 border-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-right-8 duration-300">

      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-primary bg-primary text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <h2 className="font-black uppercase tracking-wider text-sm">Onizuka Sensei</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-black/20 text-xs text-white border-2 border-white/20 rounded p-1 focus:outline-none focus:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer"
            title="Select AI Provider"
          >
            <option value="">Default Provider</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <option value="groq">Groq</option>
          </select>
          <button
            onClick={onClose}
            className="text-white hover:bg-black/20 rounded p-1 transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto flex flex-col bg-surface custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={clsx(
            "flex flex-col gap-3 px-5 py-6 border-b-2 border-on-surface/5",
            msg.role === 'user' ? "bg-surface" : "bg-surface-container-lowest"
          )}>
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
                <div className="relative">
                  <MarkdownRenderer content={msg.content} />
                  {isLoading && idx === messages.length - 1 && (
                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle mt-1" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface shrink-0 border-t-2 border-on-surface/10">
        <div className="flex items-center bg-surface-container-lowest border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus-within:border-primary transition-colors">
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
        <p className="text-[10px] text-on-surface-variant text-center mt-3 font-bold uppercase tracking-widest">
          Onizuka can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
