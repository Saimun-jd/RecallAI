import { client } from '../api/client';
import { store, setNoteGeneration, updateNoteGenerationProgress } from '../store';

type NoteCompleteListener = (topicId: number, noteContent: string) => void;

class NoteGenerationRunner {
  private activeTopicId: number | null = null;
  private listeners: Set<NoteCompleteListener> = new Set();

  public isGeneratingForTopic(topicId: number): boolean {
    return this.activeTopicId === topicId;
  }

  public getActiveTopicId(): number | null {
    return this.activeTopicId;
  }

  public subscribe(listener: NoteCompleteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async startGeneration(
    topicId: number,
    topicTitle: string,
    activeProvider?: string | null,
    existingNoteMarkdown: string = ''
  ): Promise<void> {
    if (this.activeTopicId === topicId) {
      console.warn(`[NoteGenerationRunner] Already generating notes for topic ${topicId}`);
      return;
    }

    if (this.activeTopicId !== null) {
      throw new Error(`Note generation is already in progress for another topic (ID: ${this.activeTopicId}). Please wait for it to finish.`);
    }

    this.activeTopicId = topicId;

    store.dispatch(
      setNoteGeneration({
        isGenerating: true,
        topicId,
        topicTitle,
        progress: 5,
        stage: 'starting',
        message: 'Initializing Cornell Study Guide...',
      })
    );

    try {
      const res = await client.generateNoteScaffoldStream(
        topicId,
        activeProvider || undefined,
        (event) => {
          store.dispatch(
            updateNoteGenerationProgress({
              stage: event.stage || event.status,
              current: event.current,
              total: event.total,
              progress: event.progress !== undefined ? event.progress : undefined,
              childTitle: event.child_title,
              message: event.message || (event.child_title ? `Working on: ${event.child_title}` : undefined),
            })
          );
        }
      );

      const scaffoldText = res.scaffold || res.note || '';
      if (!scaffoldText) {
        throw new Error('No study notes content returned by the AI provider.');
      }

      const existing = existingNoteMarkdown.trim();
      const combined = existing
        ? `${existing}\n\n---\n\n${scaffoldText}`
        : scaffoldText;

      // Save combined note to database
      await client.updateNote(topicId, combined);

      // Notify all active listeners
      this.listeners.forEach((listener) => {
        try {
          listener(topicId, combined);
        } catch (err) {
          console.error('[NoteGenerationRunner] Listener error:', err);
        }
      });

      store.dispatch(
        updateNoteGenerationProgress({
          isGenerating: false,
          progress: 100,
          stage: 'complete',
          message: 'Cornell Study Guide generated successfully!',
          completedAt: Date.now(),
        })
      );

      setTimeout(() => {
        if (this.activeTopicId === topicId) {
          store.dispatch(setNoteGeneration(null));
          this.activeTopicId = null;
        }
      }, 2000);
    } catch (err: any) {
      console.error('[NoteGenerationRunner] Generation error:', err);
      store.dispatch(
        updateNoteGenerationProgress({
          isGenerating: false,
          error: err?.userMessage || err?.message || 'Failed to generate Cornell notes.',
        })
      );
      this.activeTopicId = null;
      throw err;
    }
  }
}

export const noteGenerationRunner = new NoteGenerationRunner();
