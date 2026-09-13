import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Loader2, X } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { API_BASE, type DocumentUploadResponse } from '../../api/client';

export interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (uploaded: DocumentUploadResponse) => void;
}

const MAX_PDF_BYTES = 50 * 1024 * 1024;   // 50 MB
const MAX_TEXT_BYTES = 10 * 1024 * 1024;  // 10 MB

export function UploadDocumentModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: UploadDocumentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setValidationError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    resetState();
    onClose();
  };

  const validateFile = (file: File): string | null => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.pdf', '.txt', '.md', '.markdown'];
    if (!allowed.includes(ext)) {
      return `Unsupported file format "${ext}". Allowed formats: .pdf, .txt, .md`;
    }

    if (file.size === 0) {
      return 'Selected file is empty (0 bytes).';
    }

    if (ext === '.pdf' && file.size > MAX_PDF_BYTES) {
      return `PDF exceeds maximum allowed size of 50 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
    }

    if (['.txt', '.md', '.markdown'].includes(ext) && file.size > MAX_TEXT_BYTES) {
      return `Text/Markdown file exceeds maximum allowed size of 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    setValidationError(null);
    const err = validateFile(file);
    if (err) {
      setValidationError(err);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
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
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Uploading file...');

    const token = localStorage.getItem('recall_token');
    const formData = new FormData();
    formData.append('file', selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/v1/documents/upload`, true);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
        if (percent === 100) {
          setUploadStatus('Enqueuing knowledge processing...');
        }
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          const data: DocumentUploadResponse = res.data;
          setUploadStatus('Document uploaded successfully!');
          setTimeout(() => {
            onUploadSuccess(data);
            resetState();
            onClose();
          }, 400);
        } catch {
          setValidationError('Invalid server response.');
          setIsUploading(false);
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          setValidationError(errRes.error?.user_message || errRes.message || 'Failed to upload document.');
        } catch {
          setValidationError(`Upload failed (${xhr.status} ${xhr.statusText})`);
        }
        setIsUploading(false);
      }
    };

    xhr.onerror = () => {
      setValidationError('Network error occurred during upload. Please check your connection.');
      setIsUploading(false);
    };

    xhr.send(formData);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Knowledge Document"
      description="Upload learning materials to generate summaries, extract concepts, and create review material."
      maxWidth="md"
    >
      <div className="p-6 space-y-5">
        {/* Hidden File Picker */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.txt,.md,.markdown"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
          className="hidden"
        />

        {/* Drag & Drop Area */}
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary/10 shadow-neo-sm'
                : 'border-border-default hover:border-primary/50 hover:bg-surface-container-low/50'
            }`}
          >
            <div className="w-14 h-14 rounded-xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center mb-3 shadow-neo-sm">
              <Upload size={28} />
            </div>
            <h3 className="font-extrabold text-base text-on-surface mb-1">
              Drag and drop your file here
            </h3>
            <p className="text-xs text-on-surface-variant font-medium mb-3">
              or click to browse from your computer
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-[11px] font-bold text-on-surface-variant">
              <span className="px-2 py-0.5 rounded-md bg-surface-container border border-border-default">
                PDF (up to 50 MB)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-surface-container border border-border-default">
                Markdown / TXT (up to 10 MB)
              </span>
            </div>
          </div>
        ) : (
          /* Selected File Preview */
          <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container-low/40 flex items-center justify-between shadow-neo-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="truncate">
                <p className="font-bold text-sm text-on-surface truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-on-surface-variant font-medium">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            {!isUploading && (
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="w-8 h-8 rounded-lg border border-border-default flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                aria-label="Remove selected file"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3 rounded-xl border-2 border-error/40 bg-error/10 text-error flex items-start gap-2.5 text-xs font-bold animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Upload Progress Meter */}
        {isUploading && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-bold text-on-surface">
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin text-primary" />
                {uploadStatus}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default/70">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Upload & Ingest</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
