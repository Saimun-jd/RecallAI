import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, MessageSquare, Trash2, Edit2, Check, X, 
  Clock, AlertTriangle, Loader2 
} from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../lib/utils';
import type { ConversationResponse } from '../../api/client';

export interface ConversationSidebarProps {
  conversations: ConversationResponse[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  loading?: boolean;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
  className?: string;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  loading = false,
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
  className,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter conversations by title query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const handleStartRename = (c: ConversationResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleConfirmRename = async (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      await onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await onDeleteConversation(deletingId);
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      {/* Sidebar Header: "New Chat" Button */}
      <div className="p-3 border-b-2 border-border-default bg-surface space-y-2 shrink-0">
        <Button
          variant="primary"
          onClick={() => {
            onNewChat();
            if (onCloseMobileDrawer) onCloseMobileDrawer();
          }}
          className="w-full justify-center gap-2 text-xs shadow-neo-sm hover:shadow-neo"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>New Chat</span>
        </Button>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface border border-border-default rounded-lg text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant gap-2 text-xs font-bold">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span>Loading history...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-3 text-on-surface-variant space-y-1">
            <MessageSquare size={24} className="mx-auto opacity-30 mb-1" />
            <p className="font-bold text-xs">
              {searchQuery ? 'No matching chats' : 'No chat sessions yet'}
            </p>
            <p className="text-[11px] opacity-75">
              {searchQuery ? 'Try a different keyword' : 'Start your first knowledge dialogue'}
            </p>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = activeConversationId === c.id;
            const isEditing = editingId === c.id;

            return (
              <div
                key={c.id}
                onClick={() => {
                  if (!isEditing) {
                    onSelectConversation(c.id);
                    if (onCloseMobileDrawer) onCloseMobileDrawer();
                  }
                }}
                className={cn(
                  'group relative flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer text-left',
                  isActive
                    ? 'bg-primary/10 border-primary text-primary font-black shadow-neo-sm'
                    : 'bg-surface border-transparent hover:border-border-default/60 hover:bg-surface-container text-on-surface'
                )}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleConfirmRename(c.id, e)}
                    className="flex items-center gap-1 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="flex-1 text-xs font-bold bg-surface border border-primary rounded px-2 py-1 text-on-surface focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10"
                      title="Save title"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="p-1 rounded text-on-surface-variant hover:bg-surface-container"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1 pr-2 space-y-0.5">
                      <span className="text-xs font-bold truncate block" title={c.title}>
                        {c.title}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant/80 flex items-center gap-1">
                        <Clock size={9} />
                        <span>{formatRelativeTime(c.updated_at || c.created_at)}</span>
                      </span>
                    </div>

                    {/* Action buttons on hover / active */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(c, e)}
                        className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                        title="Rename conversation"
                        aria-label="Rename conversation"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(c.id);
                        }}
                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer info: Total count */}
      <div className="p-3 border-t-2 border-border-default bg-surface text-center shrink-0">
        <span className="text-[11px] font-mono text-on-surface-variant font-bold">
          {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
        </span>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDeletingId(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm bg-surface border-2 border-border-default rounded-2xl p-5 shadow-neo-lg z-10 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-error/10 text-error border border-error/30 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-on-surface">Delete Conversation?</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  This conversation and its grounding message history will be removed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-error hover:bg-error/90 text-white text-xs gap-1.5 border-error"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r-2 border-border-default h-full overflow-hidden',
          className
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-over Drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={onCloseMobileDrawer}
            aria-hidden="true"
          />

          {/* Drawer body */}
          <div className="relative w-4/5 max-w-xs bg-surface border-r-2 border-border-default h-full shadow-neo-lg z-10 animate-in slide-in-from-left duration-200 flex flex-col">
            <div className="p-3 border-b-2 border-border-default flex items-center justify-between bg-surface-container-low">
              <span className="font-black text-xs uppercase tracking-wider text-on-surface">
                Chat History
              </span>
              <button
                type="button"
                onClick={onCloseMobileDrawer}
                className="p-1 rounded-lg border border-border-default text-on-surface"
                aria-label="Close conversation drawer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{sidebarContent}</div>
          </div>
        </div>
      )}
    </>
  );
}
