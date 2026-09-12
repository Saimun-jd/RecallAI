import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, API_BASE, type SectionSelection } from '../api/client';
import { Book as BookIcon, Upload, Trash2, Loader2, Plus, FileText, ChevronRight, Library, Brain, Layers, CheckCircle2, Zap } from 'lucide-react';
import { IngestionProgressModal } from './IngestionProgressModal';
import { useNavigate, Link } from 'react-router-dom';
import type { RootState } from '../store';
import { setBooks, setTocTree, setIsUploading, setIngestionProgress, setCloudUploadState } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import type { ApiError } from '../api/errors';

const BookCover = ({ bookId, className }: { bookId: number, className?: string }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={clsx("bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0 border-2 border-on-background", className)}>
        <FileText size={22} strokeWidth={2} />
      </div>
    );
  }
  return (
    <div className={clsx("bg-surface-container shrink-0 border-2 border-on-background overflow-hidden", className)}>
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
  const { showToast } = useToast();
  
  const { books, isUploading, ingestionProgress } = useSelector((state: RootState) => state.library);
  const { activeProvider } = useSelector((state: RootState) => state.providers);
  const sidecarStatus = useSelector((state: RootState) => state.system.sidecarStatus);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const fetchData = async () => {
    try {
      const [booksData, analyticsData] = await Promise.all([
        client.getBooks(),
        client.getAnalytics().catch(() => null)
      ]);
      dispatch(setBooks(booksData));
      if (analyticsData) setStats(analyticsData);
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to load library data.', err?.debugDetail);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (sidecarStatus === 'connected') {
      fetchData();
    }
  }, [dispatch, sidecarStatus]);

  const processFile = async (file: File) => {
    dispatch(setIsUploading(true));
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (session && books.length >= 5) {
        showToast('error', 'Upload limit reached. You can only upload a maximum of 5 PDFs.');
        dispatch(setIsUploading(false));
        return;
      }

      const MAX_CLOUD_SIZE = 200 * 1024 * 1024; // 200MB limit
      const isOversized = file.size > MAX_CLOUD_SIZE;

      if (isOversized) {
        showToast('warning', 'File is too large for cloud backup. It will only be saved locally.');
      }

      // 1. Compute hash
      const fileHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      // 2. Upload locally first (passing 0 tells backend to determine exact page count from PDF)
      const res = await client.uploadPdfAndGetToc(file, file.name.replace('.pdf', ''), 0);
      await fetchData();
      navigate(`/books/${res.book_id}`);

      // 3. Start cloud upload in the background if not oversized and session exists
      if (!isOversized && session) {
        const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/user_pdfs/${session.user.id}/${fileHash}.pdf`;
        
        dispatch(setCloudUploadState({ isUploading: true, progress: 0, fileName: file.name }));
        
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl, true);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("x-upsert", "true");
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            dispatch(setCloudUploadState({ isUploading: true, progress: percentComplete, fileName: file.name }));
          }
        };
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Success
          } else {
            if (xhr.responseText.includes('Upload limit reached')) {
               showToast('error', 'Cloud upload limit reached.');
            } else {
               console.error("Supabase XHR upload error:", xhr.responseText);
               showToast('warning', 'Cloud backup failed, but saved locally.');
            }
          }
          dispatch(setCloudUploadState(null));
        };
        
        xhr.onerror = () => {
          console.error("Supabase XHR upload network error");
          showToast('warning', 'Cloud backup failed, but saved locally.');
          dispatch(setCloudUploadState(null));
        };
        
        xhr.send(file);
      }

    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to upload book or extract TOC.', err?.debugDetail);
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
      showToast('warning', 'Please drop a valid PDF file.');
      return;
    }
    
    processFile(file);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const book = books.find(b => b.id === id);
      await client.deleteBook(id);
      dispatch(setBooks(books.filter(b => b.id !== id)));
      showToast('success', 'Document deleted.');

      if (book) {
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          await supabase.storage.from('user_pdfs').remove([`${session.user.id}/${book.file_hash}.pdf`]);
        }
      }
    } catch (err: any) {
      showToast('error', err?.userMessage || 'Failed to delete document.', err?.debugDetail);
    }
  };

  const handleProgressComplete = () => {
    dispatch(setIngestionProgress(null));
    navigate('/review');
  };

  return (
    <div 
      className={clsx(
        "flex-1 overflow-y-auto bg-surface text-on-surface",
        isDragging ? "bg-accent-blue/5 outline-dashed outline-4 outline-on-background outline-offset-[-16px]" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center p-8 bg-surface-container-lowest border border-border-default rounded-2xl shadow-xl">
            <Upload size={40} className="text-primary mb-3" strokeWidth={2} />
            <h2 className="text-xl font-bold text-on-surface mb-1">Drop PDF to Import</h2>
            <p className="text-xs text-on-surface-variant">We'll automatically extract headings and generate topics</p>
          </div>
        </div>
      )}

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Hero Welcome Section */}
        <section className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-on-surface mb-2 tracking-tight">Welcome to Recall AI</h2>
            <p className="text-base text-on-surface-variant max-w-2xl">
              Your intelligent knowledge workspace. Manage your documents, generate flashcards, and track your progress.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/review"
              className="px-5 py-2.5 bg-primary text-on-primary font-semibold text-sm rounded-lg shadow-sm hover:bg-primary/90 hover:shadow transition-all flex items-center gap-2"
            >
              <Zap size={16} />
              <span>Start Study</span>
            </Link>
            
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center justify-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || books.length >= 5}
                className="px-5 py-2.5 bg-surface-container-lowest text-on-surface border border-border-default font-semibold text-sm rounded-lg shadow-xs hover:bg-surface-container transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Upload PDF</span>
              </button>
              <span className="text-[11px] font-medium text-on-surface-variant mt-1.5">Limit: {books.length} / 5</span>
            </div>
          </div>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* Recent Documents */}
          <div className="md:col-span-12 p-6 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-on-surface tracking-tight">Your Documents</h3>
            </div>
            
            {books.length === 0 ? (
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="border-2 border-dashed border-border-default rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[260px] cursor-pointer hover:bg-surface-container-low/60 hover:border-primary/40 transition-all group"
               >
                 <div className="w-12 h-12 border border-border-default rounded-xl bg-surface-container-low flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-2xs">
                   <Upload size={24} className="text-primary" />
                 </div>
                 <h3 className="text-base font-semibold text-on-surface mb-1">Import your first PDF</h3>
                 <p className="max-w-sm text-xs text-on-surface-variant">Let the AI chunk it into intelligent study topics and flashcards.</p>
               </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Name</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Progress</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Added</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map(book => (
                      <tr key={book.id} className="border-b border-border-default/50 hover:bg-surface-container-low/60 transition-colors group cursor-pointer" onClick={() => navigate(`/books/${book.id}`)}>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3.5">
                            <BookCover bookId={book.id} className="w-10 h-14 rounded-md border border-border-default shadow-2xs" />
                            <span className="font-semibold text-sm text-on-surface line-clamp-1">{book.title}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                           <div className="flex items-center gap-3">
                             <div className="w-28 h-2 bg-surface-container-high rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-primary rounded-full transition-all duration-300" 
                                 style={{ width: `${book.total_topics ? Math.round(((book.topics_processed || 0) / book.total_topics) * 100) : 0}%` }}
                               />
                             </div>
                             <span className="text-xs font-medium text-on-surface-variant">{book.total_topics ? Math.round(((book.topics_processed || 0) / book.total_topics) * 100) : 0}%</span>
                           </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-on-surface-variant">
                          {new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button 
                            onClick={(e) => handleDelete(e, book.id)}
                            className="p-1.5 text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                            aria-label={`Delete ${book.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Learning Progress Chart */}
          <div className="md:col-span-8 p-6 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-on-surface tracking-tight">Learning Progress</h3>
            </div>
            {loadingStats ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : stats?.forecast_7d ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.forecast_7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94A3B8" 
                      tick={{fill: '#64748B', fontSize: 11}} 
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickFormatter={(val: string) => {
                        const [, m, d] = val.split('-');
                        return `${parseInt(m)}/${parseInt(d)}`;
                      }}
                    />
                    <YAxis 
                      stroke="#94A3B8" 
                      tick={{fill: '#64748B', fontSize: 11}} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#E2E8F0', borderWidth: '1px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                      itemStyle={{ color: '#0F172A', fontWeight: '600' }}
                      labelStyle={{ color: '#64748B', marginBottom: '4px', fontSize: '11px' }}
                      formatter={(value: any) => [value, 'Due Cards']}
                      labelFormatter={(label: any) => {
                         return new Date(label + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                      }}
                    />
                    <Bar 
                      dataKey="due_count" 
                      fill="#2563EB" 
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-on-surface-variant font-medium">
                No data available
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="md:col-span-4 space-y-4">
            <div className="p-5 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Total Documents</h4>
              <div className="text-3xl font-bold text-on-surface mb-1">{stats?.totals?.books || 0}</div>
              <p className="text-xs text-on-surface-variant">In your knowledge base</p>
            </div>
            <div className="p-5 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Total Flashcards</h4>
              <div className="text-3xl font-bold text-on-surface mb-1">{stats?.totals?.flashcards || 0}</div>
              <p className="text-xs text-on-surface-variant">Generated for spaced repetition</p>
            </div>
          </div>
          
          {/* Knowledge Hub Grid */}
          <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs flex flex-col justify-center items-center text-center">
              <Layers className="text-primary mb-2" size={24} />
              <div className="text-2xl font-bold text-on-surface">{stats?.totals?.topics || 0}</div>
              <div className="text-xs font-medium text-on-surface-variant mt-0.5">Extracted Topics</div>
            </div>
            <div className="p-5 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs flex flex-col justify-center items-center text-center">
              <CheckCircle2 className="text-emerald-600 mb-2" size={24} />
              <div className="text-2xl font-bold text-on-surface">{stats?.totals?.total_reviews || 0}</div>
              <div className="text-xs font-medium text-on-surface-variant mt-0.5">Reviews Done</div>
            </div>
            <div className="p-5 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs flex flex-col justify-center items-center text-center">
              <Brain className="text-accent-blue mb-2" size={24} />
              <div className="text-2xl font-bold text-on-surface">{stats?.queue?.due_now || 0}</div>
              <div className="text-xs font-medium text-on-surface-variant mt-0.5">Due Now</div>
            </div>
            <div className="p-5 bg-surface-container-lowest border border-border-default rounded-xl shadow-xs flex flex-col justify-center items-center text-center">
              <BookIcon className="text-primary mb-2" size={24} />
              <div className="text-2xl font-bold text-on-surface">{stats?.queue?.new || 0}</div>
              <div className="text-xs font-medium text-on-surface-variant mt-0.5">New Cards</div>
            </div>
          </div>
        </div>
      </div>

      <IngestionProgressModal 
        isOpen={!!ingestionProgress} 
        progress={ingestionProgress!} 
        onComplete={handleProgressComplete} 
      />
    </div>
  );
}
