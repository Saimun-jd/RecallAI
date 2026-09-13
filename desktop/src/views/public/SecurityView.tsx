import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  Database, 
  Trash2, 
  Server, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Badge } from '../../components/ui/Tag';
import { Button } from '../../components/ui/Button';
import { PublicLayout } from '../../components/public/PublicLayout';

export function SecurityView() {
  const pillars = [
    {
      icon: <Key size={24} className="text-primary" />,
      title: "BYOK & Credential Security",
      desc: "If you provide custom API keys (OpenAI, Google Gemini, Groq), they are secured using your native operating system's Keychain/Keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service) when running our desktop application, or encrypted client-side with AES-256 GCM. Keys are only used to sign direct outbound AI generation requests."
    },
    {
      icon: <Database size={24} className="text-primary" />,
      title: "Workspace Multi-Tenant Isolation",
      desc: "All document vectors, text chunks, flashcards, and review events are tagged with strict workspace and owner identifiers. The API enforces workspace ownership verification on every database read and write, preventing cross-tenant data leakage."
    },
    {
      icon: <ShieldCheck size={24} className="text-primary" />,
      title: "Zero Model Training Guarantee",
      desc: "Your intellectual property is sacred. Recall AI contracts with enterprise API tiers and zero-data-retention endpoints where available. Your uploaded books, notes, and study prompts are never used to train or fine-tune public AI foundation models."
    },
    {
      icon: <Trash2 size={24} className="text-primary" />,
      title: "Complete Purge & Deletion",
      desc: "When you delete a document or delete your account, Recall AI permanently removes the raw file, extracted text, vector embeddings, concept nodes, and generated review cards. No ghost records remain in secondary caches."
    },
    {
      icon: <Lock size={24} className="text-primary" />,
      title: "Encryption in Transit & at Rest",
      desc: "All communications between the client, backend, and database utilize TLS 1.3 encryption. Desktop database storage relies on local SQLite with WAL mode, keeping sensitive reading records on your local drive."
    },
    {
      icon: <Server size={24} className="text-primary" />,
      title: "Standardized Authentication",
      desc: "User authentication uses cryptographic JWT tokens managed via Supabase Auth with Google OAuth. Sessions are validated on every protected API call."
    }
  ];

  return (
    <PublicLayout
      title="Security & Data Protection"
      description="Learn about Recall AI's security architecture: client-side AES-256 GCM key encryption, strict workspace isolation, and zero AI model training."
    >
      <div className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="outline" size="md">Security & Trust</Badge>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-on-surface">
            Engineered to keep your intellectual property private.
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant font-medium leading-relaxed">
            We believe you should not have to trade privacy for intelligent studying. Here is our exact security and data handling architecture.
          </p>
        </div>

        {/* Security Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {pillars.map((pillar, idx) => (
            <div 
              key={idx}
              className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-4"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-container border-2 border-border-default flex items-center justify-center shadow-neo-sm">
                {pillar.icon}
              </div>
              <h2 className="text-xl font-black text-on-surface">{pillar.title}</h2>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Fact-Based Security Commitments */}
        <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl border-2 border-primary bg-primary/5 shadow-neo space-y-6">
          <h3 className="text-xl font-black text-on-surface">Our Data Commitments</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm font-bold text-on-surface">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span>We do not sell user data or reading habits to advertising brokers.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span>We do not scrape or share your uploaded PDFs.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span>BYOK API keys are never written to unencrypted logs or analytics.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span>Full data export to open formats (Markdown, JSON) is always supported.</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link to="/app">
            <Button variant="primary" size="lg" className="font-extrabold shadow-neo">
              <span>Open Recall AI Workspace</span>
              <ArrowRight size={16} className="ml-2 stroke-[3]" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
