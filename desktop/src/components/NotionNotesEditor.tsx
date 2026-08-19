import { useEffect, useState, useRef } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { client } from '../api/client';
import { Loader2 } from 'lucide-react';

interface NotionNotesEditorProps {
  topicId: number;
}

export function NotionNotesEditor({ topicId }: NotionNotesEditorProps) {
  const [loading, setLoading] = useState(true);
  
  const editor = useCreateBlockNote();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const fetchNote = async () => {
      setLoading(true);
      try {
        const { note } = await client.getNote(topicId);
        if (!active) return;
        
        if (note) {
          const blocks = await editor.tryParseMarkdownToBlocks(note);
          editor.replaceBlocks(editor.document, blocks);
        } else {
          editor.replaceBlocks(editor.document, [
            { type: "paragraph", content: "" }
          ]);
        }
      } catch (err) {
        console.error("Failed to load note:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchNote();
    return () => { active = false; };
  }, [topicId, editor]);

  const handleChange = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(async () => {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        await client.updateNote(topicId, markdown);
      } catch (e) {
        console.error("Failed to save note:", e);
      }
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest rounded-[var(--radius-large)] border border-border-default overflow-hidden h-full relative shadow-[var(--shadow-sm)]">
      {loading && (
        <div className="absolute top-4 right-4 z-10">
          <Loader2 size={18} className="animate-spin text-accent-blue" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 relative bg-surface-container-lowest">
        <div className={loading ? "opacity-50 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
          <BlockNoteView editor={editor} theme="light" onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
