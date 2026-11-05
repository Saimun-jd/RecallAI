import React from 'react';
import { Badge } from '../../components/ui/Tag';
import { PublicLayout } from '../../components/public/PublicLayout';

export function TermsView() {
  const lastUpdated = "September 2026";

  return (
    <PublicLayout
      title="Terms of Service"
      description="Read the Terms of Service for Recall AI knowledge processing and spaced repetition software."
    >
      <div className="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="space-y-4 mb-12 border-b-2 border-border-default pb-8">
          <Badge variant="outline">Legal</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-on-surface">
            Terms of Service
          </h1>
          <p className="text-sm font-bold text-on-surface-variant">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Terms Content */}
        <div className="space-y-10 text-sm text-on-surface-variant leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">1. Agreement to Terms</h2>
            <p>
              By accessing or using Recall AI (including our web application, desktop client, and associated APIs), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">2. Description of Service</h2>
            <p>
              Recall AI provides an AI-assisted knowledge management and learning platform. Core features include document ingestion, table-of-contents extraction, grounded semantic search and conversational Q&A, automated flashcard generation, Socratic drills, and spaced repetition review scheduling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">3. User Content & Ownership</h2>
            <p>
              <strong>You retain full ownership of all materials you upload.</strong> You own the original documents (PDFs, EPUBs, text files), notes, and flashcards you create or store in your Recall AI workspace. We do not claim any intellectual property rights over your uploaded materials or study notes.
            </p>
            <p>
              You are responsible for ensuring that you have the legal right or license to upload documents to the platform for personal study, research, or organizational use.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">4. Acceptable Use Policy</h2>
            <p>When using Recall AI, you agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Upload malicious code, malware, or corrupted file formats.</li>
              <li>Attempt to reverse-engineer, decompile, or disrupt platform infrastructure or bypass quota limits.</li>
              <li>Abuse shared AI credit allotments through automated scraping or denial-of-service scripts.</li>
              <li>Upload content that infringes upon third-party copyrights or violates applicable laws.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">5. Subscriptions, Credits & BYOK</h2>
            <p>
              <strong>Free Plan:</strong> Provided at no monetary charge, subject to monthly credit, document, and storage capacity limits.
            </p>
            <p>
              <strong>Pro Subscriptions:</strong> Billed on a recurring 30-day cycle via Stripe. You may cancel at any time, retaining paid benefits through the end of the billing period.
            </p>
            <p>
              <strong>Bring Your Own Key (BYOK):</strong> When using your own API credentials, Recall AI does not charge platform credit fees for AI generation. You remain responsible for all direct billing charges incurred with your chosen AI provider (e.g., OpenAI, Google Cloud, Groq).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">6. Educational AI Disclaimer</h2>
            <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container text-on-surface text-xs sm:text-sm space-y-2">
              <p className="font-bold">Important Notice on AI-Generated Outputs:</p>
              <p>
                While Recall AI utilizes grounded retrieval with source citations to maximize accuracy, AI models may occasionally produce incomplete, inaccurate, or outdated interpretations. Recall AI is designed as a study aid; critical facts, medical guidelines, legal statutes, and engineering calculations must always be cross-referenced with your original source documents.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Recall AI and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-on-surface">8. Modifications to Terms</h2>
            <p>
              We may update these Terms from time to time. When significant changes occur, we will update the "Last Updated" date at the top of this page and provide notice within the application.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
