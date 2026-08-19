import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, API_BASE, type SectionSelection, type ProgressEvent } from '../api/client';
import { Book as BookIcon, Upload, Trash2, Loader2, Plus, FileText, ChevronRight, Library } from 'lucide-react';
import { TocSelectionModal } from './TocSelectionModal';
import { IngestionProgressModal } from './IngestionProgressModal';
import { useNavigate, Link } from 'react-router-dom';
import type { RootState } from '../store';
import { setBooks, setTocTree, setIsUploading, setIngestionProgress } from '../store';
import clsx from 'clsx';

const BookCover = ({ bookId, className }: { bookId: number, className?: string }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={clsx("bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0 border border-accent-blue/20", className)}>
        <FileText size={22} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <div className={clsx("bg-surface-container shrink-0 border border-outline-variant overflow-hidden shadow-[var(--shadow-sm)]", className)}>
      <img 
        src={`${API_BASE}/books/${bookId}/cover`} 
        alt="Book Cover" 
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
};

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
        "p-8 h-full overflow-y-auto bg-surface transition-colors",
        isDragging ? "bg-accent-blue/5 outline-dashed outline-2 outline-accent-blue/30 outline-offset-[-16px] rounded-[var(--radius-large)]" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center p-8 bg-surface-container-lowest rounded-[var(--radius-large)] border border-accent-blue/30 shadow-[var(--shadow-default)]">
            <Upload size={48} className="text-accent-blue mb-4 animate-bounce" strokeWidth={1.5} />
            <h2 className="text-2xl font-semibold text-primary mb-2">Drop PDF Here</h2>
            <p className="text-on-surface-variant text-sm">Release to import into your library</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-6 relative">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-blue/10 rounded-2xl border border-accent-blue/20 shadow-sm hidden sm:block">
            <Library className="w-8 h-8 text-accent-blue" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-[36px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-blue/70 tracking-tight leading-tight -tracking-[0.02em] mb-1">
              Library
            </h2>
            <p className="text-on-surface-variant text-[15px] font-medium opacity-80">
              Manage your study materials and extracted knowledge.
            </p>
          </div>
        </div>
        
        <div className="relative group">
          {/* Subtle glow effect behind button */}
          <div className="absolute -inset-1 bg-gradient-to-r from-accent-blue/60 to-accent-blue/30 rounded-full blur-md opacity-40 group-hover:opacity-70 transition duration-300"></div>
          
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
            className="relative flex items-center gap-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 ease-out disabled:opacity-70 shadow-lg shadow-accent-blue/25 hover:shadow-xl hover:shadow-accent-blue/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
            {isUploading ? 'Extracting TOC...' : 'Import PDF'}
          </button>
        </div>
      </div>

      {books.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-[var(--radius-large)] p-16 text-center text-on-surface-variant flex flex-col items-center justify-center min-h-[400px] cursor-pointer hover:border-accent-blue/50 hover:bg-accent-blue/5 transition-all duration-200 ease-out group"
        >
          <div className="w-20 h-20 rounded-[var(--radius-large)] bg-surface-container flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:bg-accent-blue/10 group-hover:text-accent-blue">
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-primary mb-2">Drop a PDF textbook here</h3>
          <p className="max-w-md text-sm">Import a PDF to let the AI chunk it into intelligent study topics and flashcards automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map(book => (
            <Link to={`/books/${book.id}`} key={book.id} className="block group">
              <div className="relative bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] overflow-hidden hover:border-accent-blue/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 h-full flex flex-col">
                {/* Top Cover Section */}
                <div className="relative h-44 w-full bg-surface-container-high/30 p-6 flex justify-center items-end border-b border-border-default overflow-hidden">
                  {/* Blurry background for the cover */}
                  <div className="absolute inset-0 opacity-40 blur-2xl scale-110 pointer-events-none">
                     <img src={`${API_BASE}/books/${book.id}/cover`} className="w-full h-full object-cover" alt="" />
                  </div>
                  
                  {/* The actual cover with a nice shadow */}
                  <div className="relative z-10 rounded-[var(--radius-standard)] overflow-hidden transform group-hover:-translate-y-2 transition-all duration-300 shadow-[0_12px_24px_rgb(0,0,0,0.2)]">
                    <BookCover bookId={book.id} className="w-28 h-36" />
                  </div>

                  {/* Delete button positioned absolutely */}
                  <button 
                    onClick={(e) => handleDelete(e, book.id)}
                    className="absolute top-3 right-3 text-on-surface-variant hover:text-error hover:bg-white/90 bg-white/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 rounded-full shadow-sm"
                    title="Delete Book"
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
                
                {/* Bottom Info Section */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold text-primary line-clamp-2 leading-snug mb-3 group-hover:text-accent-blue transition-colors text-[15px]" title={book.title}>
                    {book.title}
                  </h3>
                  
                  <div className="mt-auto flex flex-col gap-3">
                    {/* Progress Bar and Date */}
                    <div className="flex flex-col gap-2">
                      {(book.total_topics ?? 0) > 0 ? (
                        <div className="w-full">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-on-surface-variant font-medium text-[11px] uppercase tracking-wider">Progress</span>
                            <span className="text-accent-blue font-semibold">{Math.round(((book.topics_processed || 0) / book.total_topics!) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-accent-blue rounded-full transition-all duration-500" 
                              style={{ width: `${Math.round(((book.topics_processed || 0) / book.total_topics!) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-on-surface-variant italic">No topics extracted</div>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-on-surface-variant mt-1">
                        <span>{new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue font-medium">
                          View <ChevronRight size={14} strokeWidth={2} />
                        </div>
                      </div>
                    </div>
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
