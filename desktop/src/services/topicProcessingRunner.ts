import { client } from '../api/client';
import { store, setTopicProcessing, updateTopicProcessingProgress, clearTopicProcessing } from '../store';

type TopicCompleteListener = (topicId: number, bookId: number) => void;

class TopicProcessingRunner {
  private activeTopicIds: Set<number> = new Set();
  private listeners: Set<TopicCompleteListener> = new Set();

  public isProcessingTopic(topicId: number): boolean {
    return this.activeTopicIds.has(topicId);
  }

  public getActiveTopicIds(): number[] {
    return Array.from(this.activeTopicIds);
  }

  public subscribe(listener: TopicCompleteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async startProcessing(
    topicId: number,
    topicTitle: string,
    bookId: number,
    activeProvider?: string | null
  ): Promise<void> {
    if (this.activeTopicIds.has(topicId)) {
      console.warn(`[TopicProcessingRunner] Already processing topic ${topicId}`);
      return;
    }

    this.activeTopicIds.add(topicId);

    store.dispatch(
      setTopicProcessing({
        topicId,
        topicTitle,
        bookId,
        status: 'processing',
        stage: 'starting',
        progress: 0,
        message: 'Initializing atomic concepts extraction...',
      })
    );

    try {
      await client.processTopicStream(topicId, activeProvider || undefined, (event) => {
        store.dispatch(
          updateTopicProcessingProgress({
            topicId,
            bookId,
            status: event.status || 'processing',
            stage: event.stage,
            progress: event.progress,
            message: event.message,
            child_title: event.child_title,
            current: event.current,
            total: event.total,
          })
        );
      });

      // Notify completion listeners
      this.listeners.forEach((listener) => {
        try {
          listener(topicId, bookId);
        } catch (e) {
          console.error('[TopicProcessingRunner] Error in complete listener:', e);
        }
      });
    } catch (err: any) {
      console.error(`[TopicProcessingRunner] Failed to process topic ${topicId}:`, err);
      throw err;
    } finally {
      this.activeTopicIds.delete(topicId);
      store.dispatch(clearTopicProcessing(topicId));
    }
  }
}

export const topicProcessingRunner = new TopicProcessingRunner();
