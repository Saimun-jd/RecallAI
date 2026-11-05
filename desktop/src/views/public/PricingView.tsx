import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  X, 
  HelpCircle, 
  Key, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Database,
  ChevronDown
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Tag';
import { PublicLayout } from '../../components/public/PublicLayout';

export function PricingView() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "What is an AI credit and how are they counted?",
      a: "AI credits are consumed when you request generative AI operations (such as automatic chapter summaries, atomic concept extraction, flashcard synthesis, and Socratic quiz generation). Grounded search and review of existing cards never consume credits."
    },
    {
      q: "What is Bring Your Own Key (BYOK) and how does it affect pricing?",
      a: "BYOK is a platform capability, not a separate subscription. Any user—on Free or Pro—can plug in their personal OpenAI, Google Gemini, or Groq API key in Settings. When BYOK is active, AI credit consumption is waived to 0 credits! You only pay your AI provider directly at wholesale API prices."
    },
    {
      q: "Can I use Recall AI completely for free with my own API key?",
      a: "Yes! On the Starter Free plan, you can store up to 10 active documents and 50 MB of files. By adding your own API key, you bypass the 50 monthly credit limit and can generate as many flashcards and summaries as your personal API key permits."
    },
    {
      q: "What happens when I hit my monthly credit or document limit?",
      a: "If you exceed your 50 free monthly credits, you can either wait for your monthly renewal date, upgrade to Pro Scholar for 500 credits, or connect your personal API key to continue immediately without interruption. Your existing documents and cards remain fully accessible."
    },
    {
      q: "Can I cancel my Pro subscription at any time?",
      a: "Yes, you can cancel at any time directly through the in-app subscription portal. You will retain Pro benefits until the end of your current 30-day billing cycle."
    },
    {
      q: "Are my documents and payment details secure?",
      a: "All payment transactions are handled securely through Stripe with end-to-end encryption. Your documents are strictly isolated by workspace ID and are never used to train third-party models."
    }
  ];

  return (
    <PublicLayout
      title="Pricing & Plans"
      description="Simple, transparent pricing for Recall AI. Start free with 50 credits, upgrade to Pro Scholar for higher limits, or bring your own API keys."
    >
      <div className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="outline" size="md">Transparent Pricing</Badge>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-on-surface">
            Invest in your memory, not hidden fees.
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant font-medium">
            Start free with essential tools. Upgrade when you need higher document volume and priority generation.
          </p>
        </div>

        {/* 1. PLAN CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Starter Free */}
          <div className="p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-on-surface">Starter Free</h2>
                  <p className="text-xs text-on-surface-variant mt-1">Foundational personal learning</p>
                </div>
                <Badge variant="outline">Free Forever</Badge>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-on-surface">$0</span>
                <span className="text-sm font-bold text-on-surface-variant">/ month</span>
              </div>

              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Everything you need to experience grounded document study, interactive flashcards, and scientific spaced repetition.
              </p>

              <div className="pt-4 border-t border-border-default/60 space-y-3 text-xs sm:text-sm font-bold text-on-surface">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>50 AI Credits</strong> / month</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>10 Documents</strong> active capacity</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>50 MB</strong> cloud document storage</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span>Full Grounded RAG Chat with Citations</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span>FSRS Spaced Repetition Scheduling</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>BYOK Ready:</strong> Connect your personal keys</span>
                </div>
              </div>
            </div>

            <Link to="/app" className="w-full">
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full justify-center font-extrabold border-2 border-border-default shadow-neo-sm hover:bg-surface-container"
              >
                Get Started Free
              </Button>
            </Link>
          </div>

          {/* Pro Scholar */}
          <div className="p-8 rounded-2xl border-2 border-primary bg-surface shadow-neo-lg flex flex-col justify-between space-y-8 relative">
            <div className="absolute -top-3.5 right-6 px-3 py-1 bg-primary text-white text-[11px] font-black uppercase tracking-wider rounded-md border-2 border-border-default shadow-neo-sm">
              Recommended
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-on-surface">Pro Scholar</h2>
                  <p className="text-xs text-on-surface-variant mt-1">For heavy reading and exam mastery</p>
                </div>
                <Badge variant="primary">High Capacity</Badge>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-on-surface">$15</span>
                <span className="text-sm font-bold text-on-surface-variant">/ month</span>
              </div>

              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                For researchers, engineers, and graduate students who ingest dense volumes of technical literature and require priority processing.
              </p>

              <div className="pt-4 border-t border-border-default/60 space-y-3 text-xs sm:text-sm font-bold text-on-surface">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>500 AI Credits</strong> / month</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>100 Documents</strong> active capacity</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>2 GB</strong> cloud document storage</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>Priority Processing:</strong> Faster chunk indexing</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span><strong>Full Data Exports:</strong> Markdown & Anki JSON</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span>All Free Plan Features Included</span>
                </div>
              </div>
            </div>

            <Link to="/app" className="w-full">
              <Button 
                variant="primary" 
                size="lg" 
                className="w-full justify-center font-extrabold shadow-neo"
              >
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        </div>

        {/* 2. BYOK CLARIFICATION BANNER */}
        <div className="max-w-4xl mx-auto mb-16 p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface-container/60 shadow-neo space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0">
                <Key size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-on-surface">Bring Your Own Key (BYOK) Capability</h3>
                <p className="text-xs text-on-surface-variant">BYOK is a platform capability available to all users, not a subscription plan.</p>
              </div>
            </div>
            <Badge variant="outline" size="md">0 Credit Deduction</Badge>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            Prefer direct control over your AI provider? Connect your personal OpenAI, Google Gemini, or Groq API keys directly in Settings. When using your own key, <strong>credit deduction is completely waived (0 credits used)</strong>. Your keys are stored securely in your operating system's native keychain or encrypted client-side via AES-256 GCM.
          </p>
        </div>

        {/* 3. FEATURE COMPARISON TABLE */}
        <div className="max-w-4xl mx-auto mb-20">
          <h3 className="text-2xl font-black text-on-surface mb-6 text-center">Feature Comparison</h3>
          
          <div className="rounded-2xl border-2 border-border-default bg-surface shadow-neo overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-xs sm:text-sm">
              <thead className="bg-surface-container-high border-b-2 border-border-default text-on-surface font-black uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Feature</th>
                  <th className="py-3 px-4 text-center">Starter Free</th>
                  <th className="py-3 px-4 text-center">Pro Scholar</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border-default font-medium">
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Monthly AI Credits</td>
                  <td className="py-3 px-4 text-center text-on-surface-variant font-bold">50 credits</td>
                  <td className="py-3 px-4 text-center text-primary font-bold">500 credits</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Active Document Limit</td>
                  <td className="py-3 px-4 text-center text-on-surface-variant font-bold">10 documents</td>
                  <td className="py-3 px-4 text-center text-primary font-bold">100 documents</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Document Cloud Storage</td>
                  <td className="py-3 px-4 text-center text-on-surface-variant">50 MB</td>
                  <td className="py-3 px-4 text-center text-primary font-bold">2 GB</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Automatic TOC & Chunking</td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Grounded RAG with Citations</td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">FSRS Spaced Repetition</td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Flashcard & Quiz Generation</td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Markdown & Anki JSON Export</td>
                  <td className="py-3 px-4 text-center"><X size={16} className="text-on-surface-variant/40 mx-auto" /></td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">Processing Queue Priority</td>
                  <td className="py-3 px-4 text-center text-on-surface-variant">Standard</td>
                  <td className="py-3 px-4 text-center text-primary font-bold">Priority</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-bold text-on-surface">BYOK (Bring Your Own Key)</td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                  <td className="py-3 px-4 text-center"><CheckCircle2 size={16} className="text-primary mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. TRANSPARENT FAQS */}
        <div className="max-w-3xl mx-auto space-y-4">
          <h3 className="text-2xl font-black text-on-surface text-center mb-8">Frequently Asked Questions</h3>
          
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="rounded-xl border-2 border-border-default bg-surface shadow-neo-sm overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm text-on-surface hover:bg-surface-container focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-on-surface-variant leading-relaxed border-t border-border-default/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
