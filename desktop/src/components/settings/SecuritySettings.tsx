import { useState } from 'react';
import {
  ShieldAlert,
  KeyRound,
  LogOut,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { client, API_BASE } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

export function SecuritySettings() {
  const { user, workspace, logout } = useAuth();
  const { showToast } = useToast();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Danger Zone / Delete All Data modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await client.changePassword(currentPassword, newPassword);
      showToast('success', 'Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.message || 'Failed to change password. Verify your current password is correct.';
      setPasswordError(msg);
      showToast('error', msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (confirmDeleteText !== 'DELETE') {
      showToast('error', 'Please type DELETE in capital letters to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('recall_token') || '';
      const res = await fetch(`${API_BASE}/api/delete-all-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      showToast('success', 'All account data and local records have been wiped.');
      setIsDeleteModalOpen(false);
      await logout();
      window.location.href = '/login';
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete account data.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Session Security Overview */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b-2 border-border-default">
          <div>
            <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Active Authentication Session</h3>
            <p className="text-xs font-bold text-on-surface-variant">
              Manage your active login session and cryptographically authenticated tokens
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 bg-surface-container border-2 border-border-default hover:border-primary text-on-surface font-black uppercase text-xs rounded-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <LogOut size={14} className="text-primary" /> Sign Out Session
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-container-low border border-border-default rounded-lg">
            <span className="text-[10px] font-black uppercase text-on-surface-variant block mb-1">Session Status</span>
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Active JWT Session
            </span>
          </div>

          <div className="p-4 bg-surface-container-low border border-border-default rounded-lg">
            <span className="text-[10px] font-black uppercase text-on-surface-variant block mb-1">Account Role</span>
            <span className="text-xs font-bold text-on-surface">Workspace Owner</span>
          </div>

          <div className="p-4 bg-surface-container-low border border-border-default rounded-lg">
            <span className="text-[10px] font-black uppercase text-on-surface-variant block mb-1">Authenticated Account</span>
            <span className="text-xs font-mono font-bold text-on-surface truncate block" title={user?.email || ''}>
              {user?.email || 'N/A'}
            </span>
          </div>
        </div>
      </section>

      {/* Password Change Section */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-5 pb-3 border-b-2 border-border-default">
          <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Change Password</h3>
          <p className="text-xs font-bold text-on-surface-variant">Update your Recall AI login credentials</p>
        </div>

        {passwordError && (
          <div className="mb-4 p-3 bg-rose-500/10 border-2 border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-black uppercase text-on-surface mb-1.5">
              Current Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                className="w-full bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5 pr-10 text-xs font-mono text-on-surface focus:outline-none focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface cursor-pointer"
                title={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-on-surface mb-1.5">
                New Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  className="w-full bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5 pr-10 text-xs font-mono text-on-surface focus:outline-none focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-black uppercase text-on-surface mb-1.5">
                Confirm New Password
              </label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                className="w-full bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword}
              className="px-5 py-2.5 bg-primary text-on-primary font-black uppercase text-xs rounded-lg border-2 border-primary shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-neo-sm flex items-center gap-2 cursor-pointer"
            >
              {changingPassword && <Loader2 size={12} className="animate-spin" />}
              {changingPassword ? 'Verifying & Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Danger Zone: Permanent Account & Data Deletion */}
      <section className="bg-rose-500/5 border-2 border-rose-500/40 rounded-xl p-6 shadow-neo-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-500">
              <ShieldAlert size={18} />
              <h3 className="text-lg font-black uppercase tracking-tight">Danger Zone</h3>
            </div>
            <p className="text-sm font-black uppercase text-on-surface">Delete All Account Data & Reset Device</p>
            <p className="text-xs font-medium text-on-surface-variant max-w-xl leading-relaxed">
              Permanently wipes all uploaded documents, processed chunks, knowledge graph topics, flashcards, review schedules, and cloud synchronization data. This action is irreversible.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmDeleteText('');
              setIsDeleteModalOpen(true);
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs rounded-lg shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Trash2 size={14} /> Wipe Account Data
          </button>
        </div>
      </section>

      {/* Accessible Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md bg-surface border-4 border-rose-500 rounded-xl p-6 shadow-neo space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-rose-500">
              <ShieldAlert size={22} className="shrink-0" />
              <h3 id="delete-dialog-title" className="text-base font-black uppercase">
                Confirm Irreversible Account Deletion
              </h3>
            </div>

            <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
              This will immediately purge all local and cloud database records associated with your account.
              To confirm, please type <span className="font-mono font-black text-rose-500">DELETE</span> in the box below.
            </p>

            <input
              type="text"
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoFocus
              className="w-full bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2 text-sm font-mono font-bold text-on-surface focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 font-bold uppercase text-xs rounded-lg border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllData}
                disabled={confirmDeleteText !== 'DELETE' || isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs rounded-lg shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 size={12} className="animate-spin" />}
                {isDeleting ? 'Purging All Data...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
