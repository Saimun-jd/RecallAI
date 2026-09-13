import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { client, API_BASE, type AnalyticsStats } from '../api/client';
import { Book as BookIcon, Upload, Trash2, Loader2, Plus, Zap, Search, Play, BookOpen, Layers, BrainCircuit, Flame, Target } from 'lucide-react';
import { IngestionProgressModal } from './IngestionProgressModal';
import { useNavigate, Link } from 'react-router-dom';
import type { RootState } from '../store';
import { setBooks, setTocTree, setIsUploading, setIngestionProgress, setCloudUploadState } from '../store';
import clsx from 'clsx';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import type { ApiError } from '../api/errors';
import libraryBgImg from '../assets/library-bg.jpg';

/* ── Book Cover Thumbnail ─────────────────────────────────────────────── */

const BookCover = ({ bookId, title, className, style }: { bookId: number; title?: string; className?: string; style?: React.CSSProperties }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={clsx("bg-surface-container-high text-on-surface flex flex-col items-center justify-center p-4 text-center h-full w-full relative overflow-hidden", className)} style={style}>
        <div className="w-10 h-10 border-2 border-on-background bg-secondary-container flex items-center justify-center mb-2 shadow-[2px_2px_0px_0px_#191b23]">
          <BookIcon size={20} strokeWidth={2.5} />
        </div>
        {title && (
          <span className="font-black text-[10px] uppercase tracking-tight text-on-background line-clamp-3 leading-snug">
            {title}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={clsx("w-full h-full bg-surface-container overflow-hidden relative", className)} style={style}>
      <img
        src={`${API_BASE}/books/${bookId}/cover`}
        alt={title || "Book Cover"}
        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        onError={() => setError(true)}
      />
    </div>
  );
};

/* ── Main Library View ────────────────────────────────────────────────── */

export function LibraryView() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showToast } = useToast();

  const { books, isUploading, ingestionProgress } = useSelector((state: RootState) => state.library);
  const { activeProvider } = useSelector((state: RootState) => state.providers);
  const sidecarStatus = useSelector((state: RootState) => state.system.sidecarStatus);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);

  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pick the most recently read or added book as the "continue reading" candidate
  const continueBook = books.length > 0
    ? [...books].sort((a, b) => {
      const timeA = new Date(a.last_read_at || a.created_at).getTime();
      const timeB = new Date(b.last_read_at || b.created_at).getTime();
      return timeB - timeA;
    })[0]
    : null;

  const getResumeUrl = (book: typeof continueBook) => {
    if (!book) return '/';
    if (book.last_topic_id) {
      return `/books/${book.id}?topic=${book.last_topic_id}`;
    }
    if (book.last_read_page && book.last_read_page > 1) {
      return `/books/${book.id}?page=${book.last_read_page}`;
    }
    return `/books/${book.id}`;
  };

  const fetchData = async () => {
    try {
      const booksData = await client.getBooks();
      dispatch(setBooks(booksData));
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.userMessage || 'Failed to load library data.', err?.debugDetail);
    }
  };

  useEffect(() => {
    if (sidecarStatus === 'connected') {
      fetchData();
      client.getAnalytics()
        .then(data => setAnalytics(data))
        .catch(err => console.error('Analytics fetch error:', err));
    }
  }, [dispatch, sidecarStatus]);

  /* ── File Upload Logic ──────────────────────────────────────────────── */

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

  /* ── Computed Stats ─────────────────────────────────────────────────── */

  const totalFlashcards = analytics?.totals?.flashcards ?? 0;
  const totalReviews = analytics?.totals?.total_reviews ?? 0;
  const dueNow = analytics?.queue?.due_now ?? 0;
  const avgDifficulty = analytics?.fsrs_metrics?.average_difficulty ?? 0;
  // Derive "mastery" as inverse of average difficulty (0-10 scale → percentage)
  const masteryPercent = avgDifficulty > 0 ? Math.round((1 - avgDifficulty / 10) * 100) : 0;

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      className={clsx(
        "min-h-full flex-1 bg-surface-container-low text-on-surface relative overflow-hidden flex flex-col",
        isDragging ? "bg-accent-blue/5 outline-dashed outline-4 outline-on-background outline-offset-[-16px]" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-View Seamless Background Illustration */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={libraryBgImg}
          alt=""
          className="w-full h-full object-cover object-center opacity-30 mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-surface-container-low/30" />
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center p-8 bg-white border-4 border-on-background neo-shadow-lg">
            <Upload size={48} className="text-on-background mb-4 animate-bounce" strokeWidth={2.5} />
            <h2 className="text-3xl font-black text-on-background mb-2 uppercase">Drop PDF Here</h2>
          </div>
        </div>
      )}

      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <div className="p-4 sm:p-5 lg:p-6 w-full relative z-10 flex-1 flex flex-col gap-4 overflow-y-auto">

        {/* ── Row 1: Continue Reading Banner (full width) ─────────────── */}
        {continueBook ? (
          <div
            className="bg-surface-container-lowest/95 backdrop-blur-[2px] border-4 border-on-background neo-shadow p-4 sm:p-5 cursor-pointer group transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#191b23]"
            onClick={() => navigate(getResumeUrl(continueBook))}
          >
            <div className="flex items-center gap-4">
              {/* Mini cover thumbnail */}
              <div className="w-[50px] h-[68px] border-2 border-on-background shadow-[2px_2px_0px_0px_#191b23] overflow-hidden shrink-0 bg-surface-container hidden sm:block">
                <BookCover bookId={continueBook.id} title={continueBook.title} className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Continue reading
                </span>
                <h2 className="text-base sm:text-lg font-black text-on-background mt-0.5 truncate leading-tight">
                  {continueBook.title}
                </h2>

                {/* Progress bar */}
                {(() => {
                  let progress = 0;
                  let progressLabel = "";

                  if (continueBook.last_read_page && continueBook.total_pages && continueBook.total_pages > 0) {
                    progress = Math.min(100, Math.max(1, Math.round((continueBook.last_read_page / continueBook.total_pages) * 100)));
                    progressLabel = `Page ${continueBook.last_read_page} of ${continueBook.total_pages} (${progress}%)`;
                  } else if (continueBook.total_topics && continueBook.total_topics > 0) {
                    progress = Math.round(((continueBook.topics_processed || 0) / continueBook.total_topics) * 100);
                    progressLabel = `${progress}% through`;
                  }

                  return (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-surface border-2 border-on-background overflow-hidden">
                        <div
                          className="h-full bg-[#4a7c3f] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-on-surface-variant whitespace-nowrap">
                        {progressLabel || `${progress}% through`}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <button
                className="px-4 py-2.5 bg-on-background text-white font-black text-xs uppercase tracking-wide flex items-center gap-2 border-2 border-on-background shadow-[3px_3px_0px_0px_#434654] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all shrink-0"
                onClick={(e) => { e.stopPropagation(); navigate(getResumeUrl(continueBook)); }}
              >
                <Play size={14} strokeWidth={3} fill="currentColor" />
                Resume
              </button>
            </div>
          </div>
        ) : (
          /* Empty state: Upload CTA */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-surface-container-lowest/95 backdrop-blur-[2px] border-4 border-dashed border-on-background p-8 sm:p-10 text-center flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container transition-all group neo-shadow"
          >
            <div className="w-14 h-14 border-4 border-on-background bg-secondary-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_#191b23]">
              <Upload size={28} strokeWidth={2.5} className="text-on-background" />
            </div>
            <h3 className="text-lg font-black uppercase mb-1 text-on-background">Upload your first PDF</h3>
            <p className="max-w-md text-xs font-medium text-on-surface-variant">Let the AI chunk it into intelligent study topics and flashcards.</p>
          </div>
        )}

        {/* ── Row 2: Two-column desktop layout ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 flex-1 min-h-0">

          {/* ── Left Column: Stats + Shelf ──────────────────────────── */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: BookOpen, value: books.length, label: 'documents' },
                { icon: Layers, value: totalFlashcards, label: 'flashcards' },
                { icon: Flame, value: dueNow, label: 'due now' },
                { icon: Target, value: `${masteryPercent}%`, label: 'mastery' },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="bg-surface-container-lowest/95 backdrop-blur-[2px] border-2 border-on-background shadow-[3px_3px_0px_0px_#191b23] p-3 sm:p-4 flex flex-col gap-1"
                >
                  <Icon size={14} strokeWidth={2.5} className="text-on-surface-variant" />
                  <span className="text-2xl sm:text-3xl font-black text-on-background leading-none mt-1">
                    {value}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Your Shelf — book covers in a wrapping grid */}
            <div className="bg-surface-container-lowest/95 backdrop-blur-[2px] border-4 border-on-background neo-shadow p-4 sm:p-5 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-on-background">
                    Your shelf
                  </h3>
                  <span className="text-[10px] font-black text-on-surface-variant">
                    — {books.length} / 5
                  </span>
                </div>

                {books.length > 0 && (
                  <div className="relative w-44 sm:w-52">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" strokeWidth={2.5} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 bg-surface border-2 border-on-background text-[10px] font-bold text-on-background placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-white shadow-[2px_2px_0px_0px_#191b23] transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Book covers grid that fills available space */}
              <div className="flex flex-wrap gap-3">
                {filteredBooks.map(book => (
                  <div
                    key={book.id}
                    className="group relative cursor-pointer transition-all duration-200 hover:-translate-y-1"
                    onClick={() => navigate(`/books/${book.id}`)}
                    title={book.title}
                  >
                    {/* Book cover with spine effect */}
                    <div className="w-[110px] sm:w-[130px] lg:w-[140px] h-[150px] sm:h-[178px] lg:h-[192px] border-2 border-on-background shadow-[3px_3px_0px_0px_#191b23] overflow-hidden relative bg-surface-container">
                      <BookCover
                        bookId={book.id}
                        title={book.title}
                        className="w-full h-full"
                      />
                      {/* Spine highlight */}
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-on-background/20" />
                    </div>

                    {/* Book title below cover */}
                    <p className="mt-1.5 text-[10px] font-bold text-on-background leading-tight line-clamp-2 w-[110px] sm:w-[130px] lg:w-[140px]">
                      {book.title}
                    </p>

                    {/* Delete button on hover */}
                    <button
                      onClick={(e) => handleDelete(e, book.id)}
                      title="Delete"
                      className="absolute -top-1.5 -right-1.5 p-1 bg-surface-container border-2 border-on-background text-on-background hover:bg-error hover:text-white transition-colors shadow-[2px_2px_0px_0px_#191b23] opacity-0 group-hover:opacity-100 z-10"
                    >
                      <Trash2 size={10} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}

                {/* Empty search results */}
                {filteredBooks.length === 0 && searchQuery && (
                  <div className="flex items-center justify-center w-full py-6">
                    <div className="text-center">
                      <p className="font-bold text-on-surface-variant text-xs">No documents match &ldquo;{searchQuery}&rdquo;</p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-1 text-[10px] font-black uppercase underline hover:text-primary"
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                )}

                {/* Add new book slot */}
                {!searchQuery && books.length < 5 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[110px] sm:w-[130px] lg:w-[140px] h-[150px] sm:h-[178px] lg:h-[192px] border-2 border-dashed border-on-background/40 hover:border-on-background flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-surface-container group"
                  >
                    <div className="w-9 h-9 border-2 border-on-background/40 group-hover:border-on-background bg-surface-container flex items-center justify-center group-hover:bg-on-background group-hover:text-white transition-all">
                      <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-on-surface-variant text-center leading-tight px-1">
                      {isUploading ? (
                        <Loader2 size={14} className="animate-spin mx-auto" />
                      ) : (
                        <>Add PDF</>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Shelf edge (decorative bottom line) */}
              <div className="mt-3 h-[3px] bg-on-background/15 rounded-full" />
            </div>
          </div>

          {/* ── Right Column: Activity + Quick Actions ──────────────── */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* Quick Actions */}
            <div className="bg-surface-container-lowest/95 backdrop-blur-[2px] border-4 border-on-background neo-shadow p-4 sm:p-5">
              <h3 className="text-sm font-black uppercase tracking-tight text-on-background mb-3">
                Quick actions
              </h3>
              <div className="flex flex-col gap-2">
                <Link
                  to="/review"
                  className="w-full px-4 py-2.5 bg-on-background text-white border-2 border-on-background shadow-[3px_3px_0px_0px_#434654] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                >
                  <Zap size={14} strokeWidth={2.5} />
                  Start Study Session
                </Link>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || books.length >= 5}
                  title={books.length >= 5 ? "Upload limit reached (5/5)" : "Upload PDF"}
                  className="w-full px-4 py-2.5 bg-surface-container-lowest border-2 border-on-background shadow-[3px_3px_0px_0px_#191b23] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-on-background"
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin" strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
                  Upload PDF
                </button>

                <Link
                  to="/analytics"
                  className="w-full px-4 py-2.5 bg-surface-container-lowest border-2 border-on-background shadow-[3px_3px_0px_0px_#191b23] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 text-on-background"
                >
                  <Target size={14} strokeWidth={2.5} />
                  View Analytics
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface-container-lowest/95 backdrop-blur-[2px] border-4 border-on-background neo-shadow p-4 sm:p-5 flex-1">
              <h3 className="text-sm font-black uppercase tracking-tight text-on-background mb-3">
                Recent activity
              </h3>

              <div className="divide-y-2 divide-on-background/10">
                {books.length === 0 && !analytics ? (
                  <div className="py-6 text-center text-xs font-bold text-on-surface-variant">
                    No activity yet — upload a PDF to get started.
                  </div>
                ) : (
                  <>
                    {/* Due cards activity */}
                    {dueNow > 0 && (
                      <div className="flex items-center justify-between py-2.5 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BrainCircuit size={14} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
                          <span className="text-xs font-bold text-on-background truncate">
                            {dueNow} flashcards due for review
                          </span>
                        </div>
                        <Link
                          to="/review"
                          className="text-[10px] font-black uppercase text-primary hover:underline shrink-0"
                        >
                          Review now
                        </Link>
                      </div>
                    )}

                    {/* Total reviews stat */}
                    {totalReviews > 0 && (
                      <div className="flex items-center justify-between py-2.5 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Target size={14} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
                          <span className="text-xs font-bold text-on-background truncate">
                            Completed {totalReviews} total reviews
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant shrink-0">
                          all time
                        </span>
                      </div>
                    )}

                    {/* Show recent books uploaded */}
                    {[...books]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 5)
                      .map(book => {
                        const timeAgo = getTimeAgo(book.created_at);
                        return (
                          <div key={book.id} className="flex items-center justify-between py-2.5 gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Upload size={14} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
                              <span className="text-xs font-bold text-on-background truncate">
                                Uploaded {book.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-on-surface-variant shrink-0">
                              {timeAgo}
                            </span>
                          </div>
                        );
                      })}

                    {/* Flashcard queue breakdown */}
                    {analytics && (analytics.queue.new > 0 || analytics.queue.learning > 0 || analytics.queue.review > 0) && (
                      <div className="py-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Card queue
                        </span>
                        <div className="flex gap-3 mt-1">
                          {[
                            { label: 'New', count: analytics.queue.new, color: 'bg-blue-500' },
                            { label: 'Learning', count: analytics.queue.learning, color: 'bg-amber-500' },
                            { label: 'Review', count: analytics.queue.review, color: 'bg-green-600' },
                          ].map(({ label, count, color }) => (
                            <div key={label} className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 ${color} border border-on-background/30`} />
                              <span className="text-[10px] font-bold text-on-background">{count}</span>
                              <span className="text-[10px] font-bold text-on-surface-variant">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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

/* ── Helpers ──────────────────────────────────────────────────────────── */

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
