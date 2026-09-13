import React from 'react';
import { Zap, Plus, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardHeaderProps {
  userName?: string | null;
  dueReviewCount?: number;
  onUploadClick: () => void;
}

export function DashboardHeader({
  userName,
  dueReviewCount = 0,
  onUploadClick,
}: DashboardHeaderProps) {
  // Determine time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const displayName = userName ? userName.split(' ')[0] : 'Learner';

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b-2 border-border-default/60">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <Calendar size={13} className="text-primary" />
          <span>{formattedDate}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
          {getGreeting()}, {displayName}!
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
          Your personal learning command center. Build knowledge you can actually recall.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/review"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-xs sm:text-sm shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all active:translate-x-1 active:translate-y-1"
        >
          <Zap size={16} className="fill-white/20" />
          <span>Start Review</span>
          {dueReviewCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-white text-primary text-xs font-black">
              {dueReviewCount}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border-default bg-surface text-on-surface font-extrabold text-xs sm:text-sm shadow-neo-sm hover:bg-surface-container hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all active:translate-x-1 active:translate-y-1"
        >
          <Plus size={16} />
          <span>Add Knowledge</span>
        </button>
      </div>
    </header>
  );
}
