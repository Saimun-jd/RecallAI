import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Upload, 
  Layers, 
  Search, 
  MessageSquare, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  BookOpen,
  Brain,
  FileCheck,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Tag';
import { PublicLayout } from '../../components/public/PublicLayout';

export function HowItWorksView() {
  const steps = [
    {
      num: "01",
      title: "Add Your Knowledge",
      subtitle: "Import dense textbooks, research papers, and lecture notes",
      desc: "Upload standard PDF documents, EPUB ebooks, or markdown text. Recall AI preserves full document structure, heading hierarchies, mathematical formulas, and pagination.",
      icon: <Upload size={24} className="text-primary" />,
      details: ["Automatic PDF Table of Contents extraction", "Local indexing on your device", "Preserves source page numbers for verifiable referencing"]
    },
    {
      num: "02",
      title: "Deconstruct & Structure",
      subtitle: "Atomic chunking turns walls of text into digestible concepts",
      desc: "Reading 50-page chapters in one sitting leads to cognitive overload. Recall AI breaks long chapters into self-contained semantic concepts, generating chapter synopses and key definition glossaries.",
      icon: <Layers size={24} className="text-primary" />,
      details: ["Intelligent semantic boundary detection", "Automated concept synthesis and difficulty tagging", "Direct links back to source paragraphs"]
    },
    {
      num: "03",
      title: "Ask & Ground with Citations",
      subtitle: "Converse with your documents without AI hallucinations",
      desc: "Generic AI chatbots guess answers from the general internet. Recall AI grounds every response strictly in the retrieved chunks of your uploaded book. If a fact isn't in your text, Recall AI states it clearly.",
      icon: <MessageSquare size={24} className="text-primary" />,
      details: ["Interactive citation pills jump to exact PDF pages", "Multi-document synthesis across your library", "Zero training on your private files"]
    },
    {
      num: "04",
      title: "Active Recall Synthesis",
      subtitle: "Transform passive reading into diagnostic testing",
      desc: "Recall AI automatically extracts flashcards (Question & Answer) and Socratic drill questions from key concepts. You test your actual memory rather than just passively re-reading highlighted passages.",
      icon: <Sparkles size={24} className="text-primary" />,
      details: ["Automated front/back flashcard generation", "Multiple-choice & Socratic concept drills", "Exportable to Anki and markdown format"]
    },
    {
      num: "05",
      title: "Scientific Spaced Repetition (FSRS)",
      subtitle: "Prevent the forgetting curve with mathematically optimal review",
      desc: "Based on the modern Free Spaced Repetition Scheduler (FSRS), Recall AI schedules your reviews right when memory stability is about to decay. Instead of cramming, 10 minutes a day maintains 90%+ long-term retention.",
      icon: <Clock size={24} className="text-primary" />,
      details: ["Personalized retention target calibration (default 90%)", "Adaptive difficulty and stability scoring", "Daily review queue preventing backlog stress"]
    }
  ];

  return (
    <PublicLayout
      title="How It Works"
      description="Learn how Recall AI transforms passive reading into long-term working memory through structured chunking, grounded Q&A, and FSRS spaced repetition."
    >
      <div className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="outline" size="md">The Learning Engine</Badge>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-on-surface">
            How Recall AI works
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant font-medium leading-relaxed">
            A comprehensive, scientifically grounded pipeline that bridges the gap between reading a concept and permanently retaining it.
          </p>
        </div>

        {/* 5-Step Deep-Dive */}
        <div className="max-w-4xl mx-auto space-y-10">
          {steps.map((step, index) => (
            <div 
              key={step.num}
              className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col md:flex-row gap-6 md:gap-8 items-start"
            >
              {/* Step indicator column */}
              <div className="flex md:flex-col items-center md:items-start justify-between w-full md:w-28 shrink-0 gap-3 border-b md:border-b-0 md:border-r border-border-default/60 pb-4 md:pb-0 md:pr-4">
                <span className="text-3xl sm:text-4xl font-black text-primary font-mono">{step.num}</span>
                <div className="w-12 h-12 rounded-xl bg-surface-container border-2 border-border-default flex items-center justify-center shadow-neo-sm">
                  {step.icon}
                </div>
              </div>

              {/* Step description */}
              <div className="space-y-4 flex-1">
                <div>
                  <h2 className="text-2xl font-black text-on-surface">{step.title}</h2>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mt-1">{step.subtitle}</p>
                </div>

                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {step.desc}
                </p>

                <div className="pt-2 space-y-2">
                  {step.details.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-bold text-on-surface">
                      <CheckCircle2 size={14} className="text-primary shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Workflow Summary Diagram / Banner */}
        <div className="mt-20 max-w-4xl mx-auto p-8 rounded-2xl border-2 border-primary bg-primary/5 shadow-neo-lg text-center space-y-6">
          <h3 className="text-2xl font-black text-on-surface">The Knowledge Retention Cycle</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs font-bold text-on-surface">
            <div className="p-3 rounded-lg bg-surface border border-border-default">
              1. Document
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border-default">
              2. Concepts
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border-default">
              3. Q&A Chat
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border-default">
              4. Flashcards
            </div>
            <div className="p-3 rounded-lg bg-primary text-white border border-border-default shadow-neo-sm">
              5. Long-term Memory
            </div>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl mx-auto">
            Stop letting valuable reading evaporate after one week. Experience the difference of a closed-loop study system.
          </p>

          <Link to="/app" className="inline-block">
            <Button variant="primary" size="lg" className="font-extrabold shadow-neo">
              <span>Start Learning Today</span>
              <ArrowRight size={16} className="ml-2 stroke-[3]" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
