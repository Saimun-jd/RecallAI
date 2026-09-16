import React, { useEffect, useState, useRef } from 'react';
import { client, type SystemPrompt, type TokenUsageSummary, type TokenLogEntry } from '../api/client';
import { 
  Sparkles, Sliders, Coins, RotateCcw, Save, Search, 
  Trash2, HelpCircle, Layers, Cpu, BookOpen, MessageSquare, 
  CheckCircle2, ChevronDown, ChevronUp, FileText, Undo2
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip 
} from 'recharts';
import { useToast } from '../hooks/useToast';
import clsx from 'clsx';

// Friendly metadata mapping for the 10 prompts
const PROMPT_METADATA: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; friendlyName: string; category: string; description: string }> = {
  chat_prompt: {
    icon: MessageSquare,
    friendlyName: "AI Tutor Chat (Sensei)",
    category: "Chat & Tutoring",
    description: "Defines the personality, tone, and tutoring style of Onizuka Sensei in the reading sidebar."
  },
  explain_prompt: {
    icon: HelpCircle,
    friendlyName: "Passage Explanation",
    category: "Chat & Tutoring",
    description: "Explains student-highlighted text and answers questions grounded directly in the document."
  },
  flashcard_prompt: {
    icon: Layers,
    friendlyName: "Topic Flashcards",
    category: "Flashcards & Notes",
    description: "Generates high-yield, active-recall question and answer cards for study decks."
  },
  selection_flashcard_prompt: {
    icon: FileText,
    friendlyName: "Flashcards from Selection",
    category: "Flashcards & Notes",
    description: "Generates focused flashcards directly from selected PDF text."
  },
  summary_prompt: {
    icon: BookOpen,
    friendlyName: "Topic Summary",
    category: "Flashcards & Notes",
    description: "Produces structured Markdown summaries of document sections and chapters."
  },
  cornell_scaffold_prompt: {
    icon: BookOpen,
    friendlyName: "Cornell Note Scaffolding",
    category: "Flashcards & Notes",
    description: "Structures study notes into the Cornell format with active recall cues and summaries."
  },
  socratic_question_prompt: {
    icon: HelpCircle,
    friendlyName: "Socratic Question Generator",
    category: "Socratic Drills",
    description: "Formulates deep diagnostic questions to test conceptual understanding and spot gaps."
  },
  socratic_evaluation_prompt: {
    icon: CheckCircle2,
    friendlyName: "Socratic Answer Evaluation",
    category: "Socratic Drills",
    description: "Scores student explanations and provides targeted, constructive feedback."
  },
  segment_prompt: {
    icon: Sliders,
    friendlyName: "Topic Segmentation",
    category: "Document Processing",
    description: "Breaks down long documents into distinct atomic concepts and reading topics."
  },
  markdown_cleanup_prompt: {
    icon: Sparkles,
    friendlyName: "OCR & Math Formula Cleanup",
    category: "Document Processing",
    description: "Cleans noisy scanned document text and formats LaTeX mathematical equations."
  },
};

const FEATURE_COLORS: Record<string, string> = {
  chat: '#3b82f6',
  flashcards: '#10b981',
  socratic_drill: '#f59e0b',
  segmentation: '#8b5cf6',
  summary: '#ec4899',
  explain: '#06b6d4',
  selection_flashcards: '#14b8a6',
  cornell_notes: '#f97316',
  markdown_cleanup: '#6366f1',
  paper_roadmap: '#0ea5e9',
  paper_blog_synthesis: '#d946ef',
  general: '#64748b',
};

const FEATURE_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#0ea5e9', 
  '#d946ef', '#e11d48'
];

function getFeatureColor(feature: string): string {
  if (FEATURE_COLORS[feature]) return FEATURE_COLORS[feature];
  let hash = 0;
  for (let i = 0; i < feature.length; i++) {
    hash = (hash << 5) - hash + feature.charCodeAt(i);
    hash |= 0;
  }
  return FEATURE_PALETTE[Math.abs(hash) % FEATURE_PALETTE.length];
}

function formatFeatureName(feature: string): string {
  if (!feature) return 'None';
  return feature
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const CATEGORIES = ['All', 'Chat & Tutoring', 'Flashcards & Notes', 'Socratic Drills', 'Document Processing'];

export function LLMInspectionView() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'prompts' | 'tokens'>('prompts');

  // --- Prompts State ---
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [expandedPromptKey, setExpandedPromptKey] = useState<string | null>('chat_prompt');
  const [editorText, setEditorText] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingPrompts, setLoadingPrompts] = useState<boolean>(true);
  const [savingPrompt, setSavingPrompt] = useState<boolean>(false);

  // --- Token Usage State ---
  const [tokenSummary, setTokenSummary] = useState<TokenUsageSummary | null>(null);
  const [tokenLogs, setTokenLogs] = useState<TokenLogEntry[]>([]);
  const [timeRangeDays, setTimeRangeDays] = useState<number | undefined>(30);
  const [loadingTokens, setLoadingTokens] = useState<boolean>(true);
  const [clearingTokens, setClearingTokens] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (activeTab === 'tokens') {
      fetchTokenData();
    }
  }, [activeTab, timeRangeDays]);

  const fetchPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const data = await client.getPrompts();
      setPrompts(data.prompts);
      if (data.prompts.length > 0 && !expandedPromptKey) {
        setExpandedPromptKey(data.prompts[0].key);
        setEditorText(data.prompts[0].current_template);
      } else if (expandedPromptKey) {
        const current = data.prompts.find(p => p.key === expandedPromptKey);
        if (current) setEditorText(current.current_template);
      }
    } catch (err: any) {
      showToast('error', 'Failed to load system prompts', err?.message || String(err));
    } finally {
      setLoadingPrompts(false);
    }
  };

  const fetchTokenData = async () => {
    setLoadingTokens(true);
    try {
      const [summary, history] = await Promise.all([
        client.getTokenUsageSummary(timeRangeDays),
        client.getTokenUsageHistory(50, 0),
      ]);
      setTokenSummary(summary);
      setTokenLogs(history.logs);
    } catch (err: any) {
      showToast('error', 'Failed to load token usage analytics', err?.message || String(err));
    } finally {
      setLoadingTokens(false);
    }
  };

  // Toggle expand prompt card
  const handleToggleExpand = (prompt: SystemPrompt) => {
    if (expandedPromptKey === prompt.key) {
      setExpandedPromptKey(null);
    } else {
      setExpandedPromptKey(prompt.key);
      setEditorText(prompt.current_template);
    }
  };

  // Insert variable chip at cursor position
  const handleInsertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `{${varName}}`;
    const newText = editorText.substring(0, start) + placeholder + editorText.substring(end);
    setEditorText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 10);
  };

  // Save active prompt
  const handleSavePrompt = async (prompt: SystemPrompt) => {
    setSavingPrompt(true);
    try {
      const res = await client.updatePrompt(prompt.key, editorText);
      setPrompts(prev => prev.map(p => p.key === prompt.key ? res.prompt : p));
      showToast('success', `Saved custom prompt for "${prompt.name}"`);
    } catch (err: any) {
      showToast('error', 'Validation Failed', err?.message || String(err));
    } finally {
      setSavingPrompt(false);
    }
  };

  // Reset active prompt
  const handleResetPrompt = async (prompt: SystemPrompt) => {
    if (!window.confirm(`Reset "${prompt.name}" back to factory default?`)) return;

    try {
      const res = await client.resetPrompt(prompt.key);
      setPrompts(prev => prev.map(p => p.key === prompt.key ? res.prompt : p));
      setEditorText(res.prompt.default_template);
      showToast('success', `Reset "${prompt.name}" to factory default.`);
    } catch (err: any) {
      showToast('error', 'Failed to reset prompt', err?.message || String(err));
    }
  };

  // Reset all prompts
  const handleResetAll = async () => {
    if (!window.confirm("Are you sure you want to reset ALL 10 system prompts across the app back to factory defaults?")) {
      return;
    }
    try {
      const res = await client.resetAllPrompts();
      setPrompts(res.prompts);
      if (expandedPromptKey) {
        const current = res.prompts.find(p => p.key === expandedPromptKey);
        if (current) setEditorText(current.default_template);
      }
      showToast('success', 'All system prompts have been restored to defaults.');
    } catch (err: any) {
      showToast('error', 'Failed to reset all prompts', err?.message || String(err));
    }
  };

  // Clear Token History
  const handleClearTokens = async () => {
    if (!window.confirm("Are you sure you want to clear all logged token usage data? This cannot be undone.")) {
      return;
    }
    setClearingTokens(true);
    try {
      await client.clearTokenUsage();
      await fetchTokenData();
      showToast('success', 'Token usage history cleared.');
    } catch (err: any) {
      showToast('error', 'Failed to clear token logs', err?.message || String(err));
    } finally {
      setClearingTokens(false);
    }
  };

  // Filtered prompts
  const filteredPrompts = prompts.filter(p => {
    const meta = PROMPT_METADATA[p.key];
    const category = meta ? meta.category : p.category;
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (meta && meta.friendlyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const customizedCount = prompts.filter(p => p.is_customized).length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface text-on-surface font-sans selection:bg-primary selection:text-white custom-scrollbar">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 pb-24 space-y-6">
        
        {/* Page Header */}
        <header className="border-b-2 border-on-surface pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-on-surface tracking-tight">LLM Inspection</h1>
            <p className="text-sm font-medium text-on-surface-variant mt-1">
              Customize system prompt directives and monitor AI token usage.
            </p>
          </div>

          {/* Clean Segmented Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-container border-2 border-on-surface rounded-xl shadow-[2px_2px_0px_0px_#191b23] shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('prompts')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'prompts'
                  ? "bg-primary text-white border-2 border-on-surface shadow-[1.5px_1.5px_0px_0px_#191b23]"
                  : "text-on-surface hover:bg-surface-container-high border-2 border-transparent"
              )}
            >
              <Sliders size={15} />
              <span>System Prompts</span>
              {customizedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-extrabold">
                  {customizedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'tokens'
                  ? "bg-primary text-white border-2 border-on-surface shadow-[1.5px_1.5px_0px_0px_#191b23]"
                  : "text-on-surface hover:bg-surface-container-high border-2 border-transparent"
              )}
            >
              <Coins size={15} />
              <span>Token Usage & Costs</span>
            </button>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: SYSTEM PROMPTS (ACCORDION / CARD LIST)
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'prompts' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 hide-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all cursor-pointer",
                      selectedCategory === cat
                        ? "bg-primary text-white border-on-surface shadow-[1.5px_1.5px_0px_0px_#191b23]"
                        : "bg-surface hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-on-surface/15"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[240px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-medium bg-surface border-2 border-on-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-[1.5px_1.5px_0px_0px_#191b23]"
                />
              </div>
            </div>

            {/* Prompt Cards List */}
            {loadingPrompts ? (
              <div className="p-12 text-center text-sm font-bold text-on-surface-variant">
                Loading system prompts...
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="p-12 text-center text-sm font-bold text-on-surface-variant bg-surface border-2 border-on-surface/20 rounded-xl">
                No matching prompts found for your search.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPrompts.map(prompt => {
                  const meta = PROMPT_METADATA[prompt.key] || {
                    icon: Sliders,
                    friendlyName: prompt.name,
                    category: prompt.category,
                    description: prompt.description
                  };
                  const Icon = meta.icon;
                  const isExpanded = expandedPromptKey === prompt.key;
                  const isDirty = isExpanded && editorText !== prompt.current_template;

                  return (
                    <div
                      key={prompt.key}
                      className={clsx(
                        "bg-surface border-2 border-on-surface rounded-xl transition-all overflow-hidden",
                        isExpanded 
                          ? "shadow-[4px_4px_0px_0px_#191b23]" 
                          : "shadow-[2px_2px_0px_0px_#191b23] hover:border-on-surface hover:shadow-[3px_3px_0px_0px_#191b23]"
                      )}
                    >
                      {/* Card Header (Clickable) */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(prompt)}
                        className="w-full text-left p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-surface-container-low/50 transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div className={clsx(
                            "p-2.5 rounded-lg border-2 border-on-surface shrink-0 transition-colors",
                            prompt.is_customized 
                              ? "bg-amber-400 text-black shadow-[1px_1px_0px_0px_#191b23]" 
                              : "bg-surface-container text-on-surface"
                          )}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-black text-on-surface truncate">
                                {meta.friendlyName}
                              </h3>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container text-on-surface-variant border border-on-surface/15">
                                {meta.category}
                              </span>
                              {prompt.is_customized ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-400">
                                  Customized
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-on-surface-variant font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                              {meta.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-on-surface-variant">
                          <span className="hidden sm:inline">
                            {isExpanded ? "Collapse" : "Edit"}
                          </span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {/* Expanded In-Place Editor */}
                      {isExpanded && (
                        <div className="border-t-2 border-on-surface p-4 sm:p-6 bg-surface-container-low/30 space-y-4 animate-in fade-in duration-150">
                          
                          {/* Textarea Editor */}
                          <div className="border-2 border-on-surface rounded-xl bg-surface overflow-hidden shadow-[2px_2px_0px_0px_#191b23]">
                            <textarea
                              ref={textareaRef}
                              value={editorText}
                              onChange={(e) => setEditorText(e.target.value)}
                              rows={12}
                              spellCheck={false}
                              className="w-full p-4 font-mono text-xs sm:text-sm leading-relaxed text-on-surface bg-transparent resize-y focus:outline-none custom-scrollbar"
                              placeholder="Enter prompt directive template..."
                            />
                          </div>

                          {/* Variable Chips */}
                          {prompt.variables.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-on-surface-variant text-[11px] uppercase tracking-wider">
                                Placeholders (click to insert):
                              </span>
                              {prompt.variables.map(v => (
                                <button
                                  key={v.name}
                                  type="button"
                                  onClick={() => handleInsertVariable(v.name)}
                                  title={v.description}
                                  className="px-2.5 py-1 text-xs font-mono font-bold rounded-md bg-surface border border-on-surface/20 hover:border-on-surface hover:bg-surface-container transition-all cursor-pointer"
                                >
                                  +{`{${v.name}}`}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-4 pt-2">
                            <div>
                              {prompt.is_customized && (
                                <button
                                  type="button"
                                  onClick={() => handleResetPrompt(prompt)}
                                  className="px-3.5 py-2 rounded-lg text-xs font-bold border-2 border-on-surface/30 bg-surface hover:bg-surface-container text-on-surface flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Undo2 size={14} />
                                  <span>Restore Default</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setExpandedPromptKey(null)}
                                className="px-4 py-2 rounded-lg text-xs font-bold hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
                              >
                                Close
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSavePrompt(prompt)}
                                disabled={savingPrompt || !isDirty}
                                className={clsx(
                                  "px-5 py-2 rounded-lg text-xs font-bold border-2 border-on-surface flex items-center gap-2 transition-all cursor-pointer",
                                  isDirty
                                    ? "bg-primary text-white shadow-[2px_2px_0px_0px_#191b23] hover:translate-y-[-1px] active:translate-y-[1px]"
                                    : "bg-surface-container text-on-surface-variant/50 cursor-not-allowed opacity-60"
                                )}
                              >
                                <Save size={14} />
                                <span>{savingPrompt ? "Saving..." : "Save Changes"}</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quiet Global Reset Footer */}
            {customizedCount > 0 && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="text-xs font-bold text-on-surface-variant hover:text-red-600 underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Reset all {prompts.length} prompts to factory defaults
                </button>
              </div>
            )}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: TOKEN USAGE & ANALYTICS
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tokens' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Filter & Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Time Range Selector */}
              <div className="flex items-center bg-surface-container border-2 border-on-surface rounded-xl p-1 shadow-[2px_2px_0px_0px_#191b23] self-start sm:self-auto">
                {[
                  { label: '7 Days', val: 7 },
                  { label: '30 Days', val: 30 },
                  { label: 'All Time', val: undefined },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => setTimeRangeDays(item.val)}
                    className={clsx(
                      "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      timeRangeDays === item.val
                        ? "bg-primary text-white border-2 border-on-surface shadow-[1px_1px_0px_0px_#191b23]"
                        : "text-on-surface hover:bg-surface-container-high border-2 border-transparent"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchTokenData}
                  className="h-10 px-4 border-2 border-on-surface rounded-xl bg-surface text-xs font-bold hover:bg-surface-container shadow-[2px_2px_0px_0px_#191b23] flex items-center gap-2 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <RotateCcw size={14} /> Refresh
                </button>
                <button
                  onClick={handleClearTokens}
                  disabled={clearingTokens}
                  className="h-10 px-4 border-2 border-red-500/40 text-red-600 rounded-xl bg-surface text-xs font-bold hover:bg-red-50 shadow-[2px_2px_0px_0px_#191b23] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <Trash2 size={14} /> Clear Logs
                </button>
              </div>
            </div>

            {loadingTokens && !tokenSummary ? (
              <div className="p-12 text-center text-sm font-bold text-on-surface-variant">
                Loading telemetry data...
              </div>
            ) : tokenSummary ? (
              <>
                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Tokens */}
                  <div className="border-2 border-on-surface bg-surface rounded-xl p-5 shadow-[3px_3px_0px_0px_#191b23] flex flex-col justify-between h-full min-h-[140px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total Tokens</span>
                    <div className="text-3xl font-black text-on-surface my-auto py-1">
                      {tokenSummary.totals.total_tokens.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      {tokenSummary.totals.total_requests} requests recorded
                    </span>
                  </div>

                  {/* Input vs Output */}
                  <div className="border-2 border-on-surface bg-surface rounded-xl p-5 shadow-[3px_3px_0px_0px_#191b23] flex flex-col justify-between h-full min-h-[140px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Prompt / Completion</span>
                    <div className="my-auto py-1 flex items-baseline justify-between gap-1 min-w-0">
                      <div className="min-w-0">
                        <span 
                          className="text-2xl font-black text-on-surface block truncate" 
                          title={`${tokenSummary.totals.total_prompt_tokens.toLocaleString()} Prompt Tokens`}
                        >
                          {tokenSummary.totals.total_prompt_tokens.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Prompt</span>
                      </div>
                      <span className="text-sm font-bold text-on-surface-variant/40 pb-3 shrink-0">/</span>
                      <div className="min-w-0 text-right">
                        <span 
                          className="text-2xl font-black text-primary block truncate" 
                          title={`${tokenSummary.totals.total_completion_tokens.toLocaleString()} Completion Tokens`}
                        >
                          {tokenSummary.totals.total_completion_tokens.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">Completion</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      Input tokens vs generated output
                    </span>
                  </div>

                  {/* Estimated Cost */}
                  <div className="border-2 border-on-surface bg-surface rounded-xl p-5 shadow-[3px_3px_0px_0px_#191b23] flex flex-col justify-between h-full min-h-[140px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Estimated Cost</span>
                    <div className="text-3xl font-black text-amber-600 my-auto py-1 flex items-baseline gap-1.5">
                      <span>${tokenSummary.totals.total_cost_usd.toFixed(4)}</span>
                      <span className="text-xs font-bold text-on-surface-variant">USD</span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      Commercial API rates (Ollama = $0.00)
                    </span>
                  </div>

                  {/* Top Feature */}
                  <div className="border-2 border-on-surface bg-surface rounded-xl p-5 shadow-[3px_3px_0px_0px_#191b23] flex flex-col justify-between h-full min-h-[140px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Top Feature</span>
                    <div 
                      className="text-xl font-black text-on-surface my-auto py-1 truncate"
                      title={formatFeatureName(tokenSummary.by_feature[0]?.feature || '')}
                    >
                      {formatFeatureName(tokenSummary.by_feature[0]?.feature || 'None')}
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      {tokenSummary.by_feature[0]?.total_tokens.toLocaleString() || 0} tokens consumed
                    </span>
                  </div>
                </div>

                {/* Charts & Breakdown Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  {/* Daily Volume Area Chart (2 cols) */}
                  <div className="lg:col-span-2 border-2 border-on-surface bg-surface rounded-xl p-6 shadow-[3px_3px_0px_0px_#191b23] flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="font-bold text-base text-on-surface">Daily Token Volume</h3>
                        <p className="text-xs text-on-surface-variant font-medium">Prompt input vs completion tokens over time</p>
                      </div>
                      {tokenSummary.daily_timeline.length > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold bg-surface-container px-3 py-1.5 rounded-lg border border-on-surface/20 shrink-0 self-start sm:self-auto">
                          <span className="flex items-center gap-1.5 text-on-surface">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" /> Prompt
                          </span>
                          <span className="flex items-center gap-1.5 text-on-surface">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" /> Completion
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {tokenSummary.daily_timeline.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-sm font-medium text-on-surface-variant">
                        No activity recorded during this period.
                      </div>
                    ) : (
                      <div className="h-72 w-full flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={tokenSummary.daily_timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#191b23" strokeOpacity={0.12} />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#191b23" dy={4} />
                            <YAxis 
                              tick={{ fontSize: 11, fontWeight: 'bold' }} 
                              stroke="#191b23" 
                              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                              width={45}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#F8F7F4', 
                                border: '2px solid #191b23', 
                                borderRadius: '8px',
                                boxShadow: '2px 2px 0px #191b23',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                color: '#191b23'
                              }} 
                            />
                            <Area type="monotone" dataKey="prompt_tokens" name="Prompt Tokens" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorInput)" />
                            <Area type="monotone" dataKey="completion_tokens" name="Completion Tokens" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOutput)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Feature Breakdown Progress Bars (1 col) */}
                  <div className="border-2 border-on-surface bg-surface rounded-xl p-6 shadow-[3px_3px_0px_0px_#191b23] flex flex-col h-full min-w-0">
                    <div className="mb-4">
                      <h3 className="font-bold text-base text-on-surface">Usage by Feature</h3>
                      <p className="text-xs text-on-surface-variant font-medium">Distribution across study tasks</p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 pr-1 max-h-[300px] custom-scrollbar">
                      {tokenSummary.by_feature.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-sm font-medium text-on-surface-variant">
                          No feature telemetry yet.
                        </div>
                      ) : (
                        tokenSummary.by_feature.map(feat => {
                          const pct = tokenSummary.totals.total_tokens > 0 
                            ? Math.round((feat.total_tokens / tokenSummary.totals.total_tokens) * 100) 
                            : 0;
                          const color = getFeatureColor(feat.feature);
                          const formattedName = formatFeatureName(feat.feature);

                          return (
                            <div key={feat.feature} className="space-y-1.5 min-w-0">
                              <div className="flex items-center justify-between gap-2 text-xs font-bold min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-on-surface truncate text-xs font-bold" title={formattedName}>
                                    {formattedName}
                                  </span>
                                </div>
                                <div className="text-on-surface-variant font-mono text-[11px] shrink-0 text-right">
                                  <span className="font-bold text-on-surface">{feat.total_tokens.toLocaleString()}</span>
                                  <span className="text-on-surface-variant/70 ml-1">({pct}%)</span>
                                </div>
                              </div>
                              <div className="h-[6px] w-full bg-surface-container-high rounded-full overflow-hidden border border-on-surface/10">
                                <div 
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Activity Table */}
                <div className="border-2 border-on-surface bg-surface rounded-xl p-6 shadow-[3px_3px_0px_0px_#191b23]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-base text-on-surface">Recent Generation Log</h3>
                      <p className="text-xs text-on-surface-variant font-medium">Recorded AI generation requests</p>
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md border border-on-surface/20">
                      {tokenLogs.length} events logged
                    </span>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b-2 border-on-surface bg-surface-container-low font-bold text-on-surface uppercase tracking-wider">
                          <th className="p-3">Time</th>
                          <th className="p-3">Feature</th>
                          <th className="p-3">Model</th>
                          <th className="p-3 text-right">Prompt</th>
                          <th className="p-3 text-right">Completion</th>
                          <th className="p-3 text-right">Total Tokens</th>
                          <th className="p-3 text-right">Cost ($ USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-b border-on-surface/20">
                        {tokenLogs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-on-surface-variant font-medium">
                              No generation requests logged yet. Use the AI tutor, generate flashcards, or create notes to view activity.
                            </td>
                          </tr>
                        ) : (
                          tokenLogs.map(log => (
                            <tr key={log.id} className="hover:bg-surface-container-low/50 transition-colors">
                              <td className="p-3 font-mono text-on-surface-variant whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="p-3 font-bold">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-on-surface/20 bg-surface-container text-on-surface">
                                  <span 
                                    className="w-2 h-2 rounded-full shrink-0" 
                                    style={{ backgroundColor: getFeatureColor(log.feature) }} 
                                  />
                                  {formatFeatureName(log.feature)}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-medium text-on-surface truncate max-w-[140px]">
                                {log.model || log.provider}
                              </td>
                              <td className="p-3 text-right font-mono text-on-surface-variant">
                                {log.prompt_tokens.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-primary">
                                {log.completion_tokens.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-on-surface">
                                {log.total_tokens.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-amber-600">
                                ${log.estimated_cost_usd.toFixed(4)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}

          </div>
        )}

      </div>
    </div>
  );
}
