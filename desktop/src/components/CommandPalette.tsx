import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { setCommandOpen, setCommandQuery } from '../store';
import { Book, Search, Zap, Loader2 } from 'lucide-react';

export function CommandPalette() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isOpen, query, searchIndex } = useSelector((state: RootState) => state.command);

  // Toggle with Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch(setCommandOpen(!isOpen));
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  return (
    <Command.Dialog 
      open={isOpen} 
      onOpenChange={(open) => dispatch(setCommandOpen(open))}
      label="Global Command Menu"
      className="fixed left-1/2 top-[20%] w-full max-w-xl -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center px-4 border-b border-zinc-800">
        <Search className="w-5 h-5 text-zinc-500 mr-2 shrink-0" />
        <Command.Input 
          value={query}
          onValueChange={(val) => dispatch(setCommandQuery(val))}
          placeholder="Search topics, flashcards, or jump to..."
          className="w-full border-none bg-transparent py-4 text-zinc-100 outline-none text-lg placeholder:text-zinc-500"
          autoFocus
        />
      </div>

      <Command.List className="max-h-[300px] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-zinc-500">
          No results found.
        </Command.Empty>

        <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-zinc-500">
          <Command.Item 
            onSelect={() => { navigate('/'); dispatch(setCommandOpen(false)); }}
            className="flex items-center gap-2 rounded-md px-4 py-3 text-sm text-zinc-300 cursor-pointer select-none hover:bg-emerald-500/10 hover:text-emerald-400"
          >
            <Book className="w-4 h-4" /> Go to Library
          </Command.Item>
          <Command.Item 
            onSelect={() => { navigate('/review'); dispatch(setCommandOpen(false)); }}
            className="flex items-center gap-2 rounded-md px-4 py-3 text-sm text-zinc-300 cursor-pointer select-none hover:bg-emerald-500/10 hover:text-emerald-400"
          >
            <Zap className="w-4 h-4" /> Start Review
          </Command.Item>
        </Command.Group>
        
        {/* If we had topics in searchIndex, we would map them here */}
      </Command.List>
    </Command.Dialog>
  );
}
