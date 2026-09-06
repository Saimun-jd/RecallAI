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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center p-8 bg-white border-4 border-on-background neo-shadow-lg">
            <Upload size={48} className="text-on-background mb-4 animate-bounce" strokeWidth={2.5} />
            <h2 className="text-3xl font-black text-on-background mb-2 uppercase">Drop PDF Here</h2>
          </div>
        </div>
      )}

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Hero Welcome Section */}
        <section className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div>
            <h2 className="text-4xl font-black text-on-background mb-2 tracking-tight">Welcome to Recall AI.</h2>
            <p className="text-lg text-on-surface-variant font-medium max-w-2xl">
              Your intelligent knowledge workspace. Manage your documents, generate flashcards, and track your progress.
            </p>
          </div>
          <div className="flex gap-4">
            <Link 
              to="/review"
              className="px-6 py-3 bg-[#E5E7EB] text-on-surface border-4 border-on-background neo-shadow neo-shadow-button font-bold uppercase transition-transform flex items-center gap-2"
            >
              <Zap size={20} strokeWidth={2.5} />
              Start Study
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
                className="px-6 py-3 bg-[#E5E7EB] text-on-surface border-4 border-on-background neo-shadow neo-shadow-button font-bold uppercase transition-transform flex items-center gap-2 disabled:opacity-70"
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
                Upload PDF
              </button>
              <span className="text-xs font-bold text-on-surface-variant mt-2 uppercase tracking-wide">Limit: {books.length} / 5</span>
            </div>
          </div>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* Recent Documents */}
          <div className="md:col-span-12 p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow flex flex-col neo-shadow-card transition-transform">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight">Your Documents</h3>
            </div>
            
            {books.length === 0 ? (
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="border-4 border-dashed border-on-background p-16 text-center flex flex-col items-center justify-center min-h-[300px] cursor-pointer hover:bg-surface-container transition-all group"
               >
                 <div className="w-16 h-16 border-4 border-on-background bg-secondary-container flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                   <Upload size={32} strokeWidth={2.5} className="text-on-background" />
                 </div>
                 <h3 className="text-xl font-black uppercase mb-2 text-on-background">Upload your first PDF</h3>
                 <p className="max-w-md font-medium text-on-surface-variant">Let the AI chunk it into intelligent study topics and flashcards.</p>
               </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-transparent border-b-4 border-on-background">
                      <th className="p-4 font-bold uppercase text-on-background">Name</th>
                      <th className="p-4 font-bold uppercase text-on-background">Progress</th>
                      <th className="p-4 font-bold uppercase text-on-background">Added</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map(book => (
                      <tr key={book.id} className="border-b-4 border-on-background hover:bg-surface-container transition-colors group cursor-pointer" onClick={() => navigate(`/books/${book.id}`)}>
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <BookCover bookId={book.id} className="w-12 h-16 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                            <span className="font-bold text-lg text-on-background line-clamp-1">{book.title}</span>
                          </div>
                        </td>
                        <td className="p-4">
                           <div className="flex items-center gap-3">
                             <div className="w-32 h-3 bg-surface border-2 border-on-background">
                               <div 
                                 className="h-full bg-accent-blue border-r-2 border-on-background" 
                                 style={{ width: `${book.total_topics ? Math.round(((book.topics_processed || 0) / book.total_topics) * 100) : 0}%` }}
                               />
                             </div>
                             <span className="font-bold">{book.total_topics ? Math.round(((book.topics_processed || 0) / book.total_topics) * 100) : 0}%</span>
                           </div>
                        </td>
                        <td className="p-4 font-medium text-on-surface-variant">
                          {new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={(e) => handleDelete(e, book.id)}
                            className="p-2 border-2 border-transparent hover:border-on-background hover:bg-error hover:text-white transition-all shadow-none hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          >
                            <Trash2 size={20} strokeWidth={2.5} />
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
          <div className="md:col-span-8 p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow flex flex-col neo-shadow-card transition-transform">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight">Learning Progress</h3>
            </div>
            {loadingStats ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-on-background" />
              </div>
            ) : stats?.forecast_7d ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.forecast_7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1b1b1b" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#1b1b1b" 
                      tick={{fill: '#1b1b1b', fontSize: 12, fontWeight: 'bold'}} 
                      tickLine={false}
                      axisLine={true}
                      tickFormatter={(val: string) => {
                        const [, m, d] = val.split('-');
                        return `${parseInt(m)}/${parseInt(d)}`;
                      }}
                    />
                    <YAxis 
                      stroke="#1b1b1b" 
                      tick={{fill: '#1b1b1b', fontSize: 12, fontWeight: 'bold'}} 
                      tickLine={false}
                      axisLine={true}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#1b1b1b', borderWidth: '3px', borderRadius: '0px', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
                      itemStyle={{ color: '#1b1b1b', fontWeight: 'bold' }}
                      labelStyle={{ color: '#1b1b1b', marginBottom: '4px', fontWeight: 'bold' }}
                      formatter={(value: any) => [value, 'Due Cards']}
                      labelFormatter={(label: any) => {
                         return new Date(label + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                      }}
                    />
                    <Bar 
                      dataKey="due_count" 
                      fill="#004ac6" 
                      stroke="#1b1b1b"
                      strokeWidth={3}
                      barSize={40}
                      animationDuration={1000}
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
          <div className="md:col-span-4 space-y-8">
            <div className="p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow neo-shadow-card transition-transform">
              <h4 className="font-bold uppercase mb-2 text-on-background">Total Documents</h4>
              <div className="text-5xl font-black mb-2 text-on-background">{stats?.totals?.books || 0}</div>
              <p className="font-medium text-on-surface-variant">In your knowledge base</p>
            </div>
            <div className="p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow neo-shadow-card transition-transform">
              <h4 className="font-bold uppercase mb-2 text-on-background">Total Flashcards</h4>
              <div className="text-5xl font-black mb-2 text-on-background">{stats?.totals?.flashcards || 0}</div>
              <p className="font-medium text-on-surface-variant">Generated for study</p>
            </div>
          </div>
          
          {/* Knowledge Hub Grid */}
          <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow neo-shadow-card flex flex-col justify-center items-center text-center transition-transform">
              <Layers className="text-on-background mb-2" size={32} strokeWidth={2.5} />
              <div className="text-3xl font-black text-on-background">{stats?.totals?.topics || 0}</div>
              <div className="font-bold uppercase text-sm mt-1 text-on-surface-variant">Extracted Topics</div>
            </div>
            <div className="p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow neo-shadow-card flex flex-col justify-center items-center text-center transition-transform">
              <CheckCircle2 className="text-on-background mb-2" size={32} strokeWidth={2.5} />
              <div className="text-3xl font-black text-on-background">{stats?.totals?.total_reviews || 0}</div>
              <div className="font-bold uppercase text-sm mt-1 text-on-surface-variant">Reviews Done</div>
            </div>
            <div className="p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow neo-shadow-card flex flex-col justify-center items-center text-center transition-transform">
              <Brain className="text-on-background mb-2" size={32} strokeWidth={2.5} />
              <div className="text-3xl font-black text-on-background">{stats?.queue?.due_now || 0}</div>
              <div className="font-bold uppercase text-sm mt-1 text-on-surface-variant">Due Now</div>
            </div>
            <div className="p-6 bg-surface-container-lowest border-4 border-on-background neo-shadow neo-shadow-card flex flex-col justify-center items-center text-center transition-transform">
              <BookIcon className="text-on-background mb-2" size={32} strokeWidth={2.5} />
              <div className="text-3xl font-black text-on-background">{stats?.queue?.new || 0}</div>
              <div className="font-bold uppercase text-sm mt-1 text-on-surface-variant">New Cards</div>
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
