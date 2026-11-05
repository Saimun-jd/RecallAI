export const MAX_PDF_BYTES = 50 * 1024 * 1024;   // 50 MB
export const MAX_TEXT_BYTES = 10 * 1024 * 1024;  // 10 MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates a PDF file prior to upload or processing.
 * Rejects non-PDFs, empty files, and files exceeding the 50 MB limit.
 * Returns an error message string if invalid, or null if valid.
 */
export function validatePdfFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

  if (ext !== '.pdf') {
    return `Unsupported file format "${ext || 'unknown'}". Please select a valid PDF file.`;
  }

  if (file.size === 0) {
    return 'Selected PDF file is empty (0 bytes).';
  }

  if (file.size > MAX_PDF_BYTES) {
    return `PDF exceeds maximum allowed size of 50 MB (${formatFileSize(file.size)}).`;
  }

  return null;
}

/**
 * Validates general knowledge documents (.pdf, .txt, .md, .markdown).
 * Returns an error message string if invalid, or null if valid.
 */
export function validateDocumentFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const allowed = ['.pdf', '.txt', '.md', '.markdown'];

  if (!allowed.includes(ext)) {
    return `Unsupported file format "${ext || 'unknown'}". Allowed formats: .pdf, .txt, .md`;
  }

  if (file.size === 0) {
    return 'Selected file is empty (0 bytes).';
  }

  if (ext === '.pdf' && file.size > MAX_PDF_BYTES) {
    return `PDF exceeds maximum allowed size of 50 MB (${formatFileSize(file.size)}).`;
  }

  if (['.txt', '.md', '.markdown'].includes(ext) && file.size > MAX_TEXT_BYTES) {
    return `Text/Markdown file exceeds maximum allowed size of 10 MB (${formatFileSize(file.size)}).`;
  }

  return null;
}
