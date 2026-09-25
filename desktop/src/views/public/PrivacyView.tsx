import React from 'react';
import { Badge } from '../../components/ui/Tag';
import { PublicLayout } from '../../components/public/PublicLayout';

export function PrivacyView() {
  const lastUpdated = "September 2026";

  return (
    <PublicLayout
      title="Privacy Policy"
      description="Read Recall AI's transparent privacy policy regarding uploaded documents, AI query processing, and data ownership."
    >
      <div className="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="space-y-4 mb-12 border-b-2 border-border-default pb-8">
          <Badge variant="outline">Legal</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-on-surface">
            Privacy Policy
          </h1>
          <p className="text-sm font-bold text-on-surface-variant">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-10 text-sm text-on-surface-variant leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">1. Introduction</h2>
            <p>
              Recall AI ("we", "our", or "the platform") provides knowledge processing, document indexing, and spaced repetition learning tools. We believe that your study materials, reading habits, and personal notes represent your intellectual property and private thought process. This Privacy Policy outlines what information we collect, how it is processed, and your rights to manage or delete it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">2. Information We Collect</h2>
            <div className="space-y-2">
              <p><strong>Account Data:</strong> When you sign in via Google OAuth or Supabase, we collect your email address, name, and profile identifier to authenticate your sessions and maintain your workspace.</p>
              <p><strong>Document & Study Content:</strong> When you upload PDF files, EPUBs, or markdown notes, our system parses text content into semantic chunks and creates vector embeddings to support grounded retrieval and flashcard synthesis.</p>
              <p><strong>Learning Telemetry:</strong> To schedule reviews using the Free Spaced Repetition Scheduler (FSRS), we track your review history (card ID, rating choice: Again/Hard/Good/Easy, timestamp, and resulting stability/difficulty metrics).</p>
              <p><strong>API Credentials (BYOK):</strong> If you choose to configure custom AI credentials (e.g., OpenAI, Gemini, Groq), these are stored encrypted using client-side AES-256 GCM or your operating system's native keychain.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">3. How Your Data Is Processed</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide document ingestion, table-of-contents extraction, and search capabilities.</li>
              <li>To answer grounded questions via Retrieval-Augmented Generation (RAG).</li>
              <li>To calculate mathematically optimal intervals for your daily spaced repetition queue.</li>
              <li>To process subscription billing through our payment processor (Stripe).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">4. AI Provider Interactions & Zero Training Guarantee</h2>
            <p>
              When you generate summaries, concepts, flashcards, or chat responses, the relevant document chunks and query prompts are transmitted to the configured AI provider (such as Anthropic, OpenAI, Google Gemini, or Groq).
            </p>
            <div className="p-4 rounded-xl border-2 border-primary bg-primary/5 text-on-surface font-semibold text-xs sm:text-sm">
              Recall AI uses enterprise commercial API tiers with zero-data-retention terms where available. Your uploaded documents and notes are never used by us or our AI model partners to train or fine-tune public foundation models.
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">5. Data Retention & Your Deletion Rights</h2>
            <p>
              You maintain complete ownership of your data. You may delete individual documents, flashcard decks, or entire workspaces at any time from within the application. Deletion permanently erases the raw uploaded file, its parsed text chunks, vector embeddings, and generated review cards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">6. Third-Party Subprocessors</h2>
            <div className="space-y-2">
              <p><strong>Supabase:</strong> Authentication and user session infrastructure.</p>
              <p><strong>Stripe:</strong> Payment processing and subscription management. We never store credit card numbers on Recall AI servers.</p>
              <p><strong>AI Providers:</strong> OpenAI, Google Cloud, Groq (for text completion and embedding generation).</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">7. Contact & Inquiries</h2>
            <p>
              If you have questions regarding this Privacy Policy or wish to request an archive export of your stored workspace data, please contact us at <code className="px-2 py-0.5 rounded bg-surface-container border border-border-default font-mono text-xs">privacy@recallai.app</code>.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
