import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, type SectionSelection, type ProgressEvent } from '../api/client';
import { Book as BookIcon, Upload, Trash2, Loader2, Plus, FileText, ChevronRight } from 'lucide-react';
import { TocSelectionModal } from './TocSelectionModal';
import { IngestionProgressModal } from './IngestionProgressModal';
import { useNavigate, Link } from 'react-router-dom';
import type { RootState } from '../store';
import { setBooks, setTocTree, setIsUploading, setIngestionProgress } from '../store';
import clsx from 'clsx';

export function LibraryView() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { books, tocTree, isUploading, ingestionProgress, activeBook } = useSelector((state: RootState) => state.library);
  const { activeProvider } = useSelector((state: RootState) => state.providers);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBooks = async () => {
    try {
      const data = await client.getBooks();
      dispatch(setBooks(data));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [dispatch]);


  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File) => {
    dispatch(setIsUploading(true));
    try {
      const res = await client.uploadPdfAndGetToc(file, file.name.replace('.pdf', ''), 100);
      await fetchBooks();
      navigate(`/books/${res.book_id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to upload book or extract TOC.");
    } finally {
      dispatch(setIsUploading(false));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please drop a valid PDF file.');
      return;
    }
    
    processFile(file);
  };

  const handleProcessSections = async (sections: SectionSelection[]) => {
    const currentBookId = parseInt(localStorage.getItem('pending_book_id') || '0', 10);
    if (!currentBookId) return;
    
    dispatch(setTocTree([])); // Close modal
    dispatch(setIngestionProgress({ status: 'processing', current: 0, total: 1, topic: 'Starting...' }));

    try {
      await client.processSectionsStream(
        currentBookId, 
        sections, 
        activeProvider,
        (event) => {
          if (event.status === 'processing' || event.status === 'processing_sections') {
            let pct: number | undefined;
            if (event.status === 'processing_sections' && event.completed_sections !== undefined && event.total_sections !== undefined && event.total_chunks) {
                const currentChunk = event.chunk || 1;
                const completed = event.completed_sections;
                const totalSec = Math.max(1, event.total_sections);
                pct = Math.round(((currentChunk - 1 + (completed / totalSec)) / event.total_chunks) * 100);
            } else if (event.status === 'processing') {
                const currentChunk = event.chunk || 1;
                const totalChunks = event.total_chunks || 1;
                pct = Math.round(((currentChunk - 1) / totalChunks) * 100);
            }

            dispatch(setIngestionProgress({ 
              status: 'processing', 
              current: event.chunk || 0, 
              total: event.total_chunks || 1, 
              topic: event.current_topic || 'Processing...',
              percentage: pct
            }));
          } else if (event.status === 'complete') {
            dispatch(setIngestionProgress({ status: 'complete', current: 1, total: 1, topic: 'Done!' }));
          } else if (event.status === 'error') {
            dispatch(setIngestionProgress({ status: 'error', current: 0, total: 1, topic: 'Error', error: event.error }));
          }
        }
      );
    } catch (err) {
      console.error(err);
      dispatch(setIngestionProgress({ status: 'error', current: 0, total: 1, topic: 'Error', error: String(err) }));
    }
  };

  const handleProgressComplete = () => {
    dispatch(setIngestionProgress(null));
    navigate('/review');
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      await client.deleteBook(id);
      dispatch(setBooks(books.filter(b => b.id !== id)));
    } catch (err) {
      alert("Failed to delete book.");
    }
  };

  return (
    <div 
      className={clsx(
        "p-8 h-full overflow-y-auto bg-zinc-950 transition-colors",
        isDragging ? "bg-zinc-900/80 outline-dashed outline-2 outline-emerald-500/50 outline-offset-[-16px] rounded-xl" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center p-8 bg-zinc-900 rounded-2xl border-2 border-emerald-500/50 shadow-2xl">
            <Upload size={48} className="text-emerald-400 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white mb-2">Drop PDF Here</h2>
            <p className="text-zinc-400">Release to import into your library</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto space-y-8 relative">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">Library</h2>
          <p className="text-zinc-400 text-sm mt-1">Manage your study materials and extracted knowledge.</p>
        </div>
        
        <div>
          <input 
            type="file" 
            accept="application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-5 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {isUploading ? 'Extracting TOC...' : 'Import PDF'}
          </button>
        </div>
      </div>

      {books.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-2xl p-16 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[400px] cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
        >
          <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl group-hover:bg-emerald-500/20 group-hover:text-emerald-400">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-semibold text-zinc-200 mb-2">Drop a PDF textbook here</h3>
          <p className="max-w-md">Import a PDF to let the AI chunk it into intelligent study topics and flashcards automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map(book => (
            <Link to={`/books/${book.id}`} key={book.id} className="block group">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm hover:border-zinc-700 transition-all hover:bg-zinc-800/50 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
                    <FileText size={22} />
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, book.id)}
                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-2 hover:bg-zinc-800 rounded-md"
                    title="Delete Book"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <h3 className="font-semibold text-zinc-100 line-clamp-2 leading-snug mb-2 group-hover:text-emerald-400 transition-colors" title={book.title}>
                  {book.title}
                </h3>
                
                <div className="mt-auto pt-4 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800/50">
                  <div className="flex flex-col gap-1">
                    <span>{new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {(book.total_topics ?? 0) > 0 && (
                      <span className="text-emerald-500/80 font-medium">
                        {book.topics_processed || 0}/{book.total_topics} topics processed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500">
                    View <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      </div>

      {/* Modals for progress (can remove TocSelectionModal completely if we wanted, since it's lazy) */}
      <IngestionProgressModal 
        isOpen={!!ingestionProgress} 
        progress={ingestionProgress!} 
        onComplete={handleProgressComplete} 
      />
    </div>
  );
}
