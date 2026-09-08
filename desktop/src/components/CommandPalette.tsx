import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { setCommandOpen, setCommandQuery } from '../store';
import { Book, Zap, Search, FileText, NotebookPen } from 'lucide-react';
import { client } from '../api/client';

export function CommandPalette() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isOpen, query } = useSelector((state: RootState) => state.command);
  const [results, setResults] = useState<Array<{ type: string; id: number; title: string; subtitle: string; book_id?: number }>>([]);

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

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await client.searchAll(query);
        setResults(res);
      } catch (e) {
        console.error("Search failed", e);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  if (!isOpen) return null;

  return (
    <Command.Dialog 
      open={isOpen} 
      onOpenChange={(open) => dispatch(setCommandOpen(open))}
      label="Global Command Menu"
    >
      <div cmdk-input-wrapper="">
        <Search />
        <Command.Input 
          value={query}
          onValueChange={(val) => dispatch(setCommandQuery(val))}
          placeholder="Search topics, flashcards, or jump to..."
          autoFocus
        />
      </div>

      <Command.List>
        <Command.Empty>
          No results found.
        </Command.Empty>

        <Command.Group heading="Navigation">
          <Command.Item 
            onSelect={() => { navigate('/'); dispatch(setCommandOpen(false)); }}
          >
            <Book className="w-4 h-4" strokeWidth={1.5} /> Go to Library
          </Command.Item>
          <Command.Item 
            onSelect={() => { navigate('/notes'); dispatch(setCommandOpen(false)); }}
          >
            <NotebookPen className="w-4 h-4" strokeWidth={1.5} /> Go to Notes
          </Command.Item>
          <Command.Item 
            onSelect={() => { navigate('/review'); dispatch(setCommandOpen(false)); }}
          >
            <Zap className="w-4 h-4" strokeWidth={1.5} /> Start Review
          </Command.Item>
        </Command.Group>
        
        {results.length > 0 && (
          <Command.Group heading="Search Results">
            {results.map(res => (
              <Command.Item
                key={`${res.type}-${res.id}`}
                onSelect={() => {
                  if (res.type === 'note') {
                    navigate(`/notes?topic=${res.id}`);
                  } else if (res.type === 'topic' && res.book_id) {
                    navigate(`/books/${res.book_id}?topic=${res.id}`);
                  } else if (res.type === 'flashcard' && res.book_id) {
                    navigate(`/books/${res.book_id}`);
                  }
                  dispatch(setCommandOpen(false));
                }}
              >
                {res.type === 'note' ? (
                  <NotebookPen className="w-4 h-4 mr-2" />
                ) : res.type === 'topic' ? (
                  <FileText className="w-4 h-4 mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{res.title}</span>
                  {res.subtitle && <span className="text-xs text-zinc-500 truncate max-w-sm">{res.subtitle}</span>}
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
