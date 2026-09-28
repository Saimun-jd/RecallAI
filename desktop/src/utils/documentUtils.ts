import { client, type DocumentItem } from '../api/client';

/**
 * Fetches documents from the backend API (v1 SaaS) and merges legacy local SQLite books,
 * guaranteeing offline resilience and backward compatibility across the app.
 */
export async function fetchUnifiedDocuments(limit = 100): Promise<DocumentItem[]> {
  try {
    const [v1Res, booksRes] = await Promise.allSettled([
      client.getDocuments(limit, 0),
      client.getBooks(),
    ]);

    let items: DocumentItem[] = [];

    if (v1Res.status === 'fulfilled' && v1Res.value?.documents) {
      items = [...v1Res.value.documents];
    }

    if (booksRes.status === 'fulfilled' && Array.isArray(booksRes.value)) {
      const booksList = booksRes.value;
      
      // Associate book_id with any v1 items that match title or metadata
      items = items.map((item) => {
        const matchingBook = booksList.find(
          (b: any) =>
            b.id.toString() === item.id ||
            item.metadata?.book_id === b.id ||
            (b.title && item.title && b.title.toLowerCase().trim() === item.title.toLowerCase().trim())
        );
        if (matchingBook) {
          return {
            ...item,
            metadata: {
              ...item.metadata,
              book_id: matchingBook.id,
            },
          };
        }
        return item;
      });

      // Append any legacy books that don't yet have a matching v1 document item
      const legacyItems: DocumentItem[] = booksList
        .filter((b: any) => !items.some((d) => d.id === b.id.toString() || d.metadata?.book_id === b.id))
        .map((b: any) => ({
          id: b.id.toString(),
          workspace_id: 'default',
          title: b.title || 'Untitled Document',
          source_type: 'pdf',
          total_pages: b.total_pages || 1,
          status: 'ready' as const,
          created_at: b.created_at || new Date().toISOString(),
          updated_at: b.created_at || new Date().toISOString(),
          metadata: {
            book_id: b.id,
            chunk_count: b.topics_processed || b.total_topics || 0,
            file_hash: b.file_hash,
          },
        }));
      items = [...items, ...legacyItems];
    }

    return items;
  } catch (err) {
    console.error('Failed to fetch unified documents:', err);
    return [];
  }
}

/**
 * Resolves a document's human-readable title given either a SaaS document UUID or a numeric Book ID.
 */
export async function resolveDocumentTitle(documentId: string): Promise<string | null> {
  if (!documentId) return null;

  // 1. Try v1 document endpoint
  try {
    const doc = await client.getDocument(documentId);
    if (doc?.title) return doc.title;
  } catch {
    // Fall back to books
  }

  // 2. Try books list
  try {
    const books = await client.getBooks();
    const match = books.find(
      (b: any) => b.id.toString() === documentId || b.uuid === documentId
    );
    if (match?.title) return match.title;
  } catch {
    // Ignore error
  }

  return null;
}
