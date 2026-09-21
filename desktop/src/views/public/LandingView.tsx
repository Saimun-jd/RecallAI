import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  ArrowRight, 
  Upload, 
  Sparkles, 
  Layers, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Key, 
  FileText, 
  Zap, 
  BookOpen, 
  Target, 
  ChevronRight,
  Database,
  Lock,
  Search,
  RotateCcw
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Tag';
import { PublicLayout } from '../../components/public/PublicLayout';
import { useAuth } from '../../contexts/AuthContext';
import { NeoTypewriter, NeoMarquee, FadeUp, usePrefersReducedMotion } from '../../components/ui/motion';
import { TRANSITIONS, SPRINGS, EASING } from '../../lib/motion';

export function LandingView() {
  const { status, onboardingCompleted } = useAuth();
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'ingest' | 'concepts' | 'chat' | 'review'>('chat');
  const shouldReduceMotion = usePrefersReducedMotion();

  if (status === 'authenticated') {
    return <Navigate to={onboardingCompleted ? '/app' : '/onboarding'} replace />;
  }

  const sectionViewport = { once: true, amount: 0.12 };

  return (
    <PublicLayout
      title="Turn Knowledge Into Long-Term Memory"
      description="Recall AI transforms dense textbooks and technical papers into structured concepts, grounded Q&A with citations, and FSRS spaced repetition."
    >
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b-2 border-border-default bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6">
            
            {/* Mission Badge */}
            <FadeUp delay={0}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-border-default bg-surface shadow-neo-sm hover:shadow-neo transition-all duration-150">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-on-surface">
                  Knowledge Processing & Spaced Repetition
                </span>
              </div>
            </FadeUp>

            {/* Core Headline */}
            <FadeUp delay={0.06}>
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-on-surface leading-[1.1] break-words text-balance">
                Turn your knowledge into something you can <span className="underline decoration-primary decoration-4 underline-offset-8">actually remember</span>.
              </h1>
            </FadeUp>

            {/* Subtitle */}
            <FadeUp delay={0.12}>
              <p className="text-base sm:text-lg md:text-xl text-on-surface-variant max-w-2xl leading-relaxed text-balance font-medium">
                Stop losing insights to forgotten browser tabs and dusty PDFs. Recall AI converts dense documents into structured concepts, verifiable grounded Q&A, and scientific spaced repetition.
              </p>
            </FadeUp>

            {/* Hero CTAs */}
            <FadeUp delay={0.18}>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 w-full sm:w-auto">
                <Link to="/app" className="w-full sm:w-auto">
                  <Button 
                    variant="primary" 
                    size="lg" 
                    className="w-full sm:w-auto px-8 py-3.5 text-base font-extrabold shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-neo-sm active:translate-x-1 active:translate-y-1 active:shadow-none gap-2.5 justify-center"
                  >
                    <span>Start Learning Free</span>
                    <ArrowRight size={18} className="stroke-[3]" />
                  </Button>
                </Link>

                <Link to="/how-it-works" className="w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full sm:w-auto px-6 py-3.5 text-base font-bold border-2 border-border-default bg-surface hover:bg-surface-container shadow-neo-sm gap-2 justify-center"
                  >
                    <span>Explore Workflow</span>
                    <ChevronRight size={16} />
                  </Button>
                </Link>
              </div>
            </FadeUp>

            {/* Transparent Trust Indicators */}
            <FadeUp delay={0.24}>
              <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6 pt-4 text-xs font-bold text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-primary stroke-[2.5]" />
                  <span>No credit card required</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-primary stroke-[2.5]" />
                  <span>Local-first desktop & web</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-primary stroke-[2.5]" />
                  <span>BYOK (Bring Your Own Key) ready</span>
                </span>
              </div>
            </FadeUp>
          </div>

          {/* 2. HERO PRODUCT PREVIEW (Interactive Workflow Card) */}
          <FadeUp delay={0.3} className="mt-14 max-w-5xl mx-auto">
            <div className="rounded-2xl border-2 border-border-default bg-surface shadow-neo-lg overflow-hidden transition-all duration-200">
              {/* Card Window Header */}
              <div className="px-4 py-3 bg-surface-container-high border-b-2 border-border-default flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400 border border-border-default" />
                  <div className="w-3 h-3 rounded-full bg-amber-400 border border-border-default" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400 border border-border-default" />
                  <span className="ml-2 text-xs font-mono font-bold text-on-surface-variant truncate">
                    Recall AI Workspace &bull; Grounded Knowledge Pipeline
                  </span>
                </div>
                
                {/* Workflow switcher pills */}
                <div className="hidden sm:flex items-center gap-1.5" role="tablist" aria-label="Workflow demonstration">
                  {[
                    { id: 'ingest', label: '1. Ingest' },
                    { id: 'concepts', label: '2. Structure' },
                    { id: 'chat', label: '3. Grounded Q&A' },
                    { id: 'review', label: '4. FSRS Review' },
                  ].map((tab) => {
                    const isActive = activeWorkflowTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveWorkflowTab(tab.id as any)}
                        className={`px-2.5 py-1 text-xs font-bold rounded border transition-all duration-120 cursor-pointer ${
                          isActive
                            ? 'bg-surface border-border-default text-on-surface shadow-neo-sm -translate-y-0.5'
                            : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview Content based on activeWorkflowTab */}
              <div className="p-4 sm:p-6 md:p-8 bg-surface min-h-[260px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {activeWorkflowTab === 'ingest' && (
                    <motion.div
                      key="ingest"
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={TRANSITIONS.fast}
                      className="space-y-4"
                    >
                      <div className="p-6 rounded-xl border-2 border-dashed border-border-default bg-surface-container/40 flex flex-col items-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary shadow-neo-sm">
                          <Upload size={24} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-on-surface text-base">Designing_Data_Intensive_Applications.pdf</h4>
                          <p className="text-xs text-on-surface-variant mt-1">612 pages &bull; 18.4 MB &bull; Table of Contents parsed &bull; 48 Chunks Indexed</p>
                        </div>
                        <div className="w-full max-w-md bg-surface-container-high rounded-full h-2.5 border border-border-default overflow-hidden">
                          <motion.div 
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.8, ease: EASING.snap }}
                            className="bg-primary h-full" 
                          />
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Ready for Synthesis & Study</span>
                      </div>
                    </motion.div>
                  )}

                  {activeWorkflowTab === 'concepts' && (
                    <motion.div
                      key="concepts"
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={TRANSITIONS.fast}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container/30 shadow-neo-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-primary tracking-wider">Concept #04</span>
                          <Badge variant="outline" size="sm">Chapter 5 &bull; p. 152</Badge>
                        </div>
                        <h4 className="font-extrabold text-on-surface text-base">Raft Consensus Algorithm</h4>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Deconstructs consensus into leader election, log replication, and safety. A single elected leader manages all state changes.
                        </p>
                        <div className="pt-2 flex items-center gap-2 text-xs font-bold text-on-surface">
                          <span className="px-2 py-0.5 rounded bg-surface border border-border-default">3 Flashcards</span>
                          <span className="px-2 py-0.5 rounded bg-surface border border-border-default">1 Socratic Drill</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container/30 shadow-neo-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-primary tracking-wider">Concept #07</span>
                          <Badge variant="outline" size="sm">Chapter 7 &bull; p. 228</Badge>
                        </div>
                        <h4 className="font-extrabold text-on-surface text-base">Serializable Snapshot Isolation</h4>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Optimistic concurrency control detecting read-write conflicts (rw-antidependency) without blocking concurrent read operations.
                        </p>
                        <div className="pt-2 flex items-center gap-2 text-xs font-bold text-on-surface">
                          <span className="px-2 py-0.5 rounded bg-surface border border-border-default">4 Flashcards</span>
                          <span className="px-2 py-0.5 rounded bg-surface border border-border-default">Exam Due in 2d</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeWorkflowTab === 'chat' && (
                    <motion.div
                      key="chat"
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={TRANSITIONS.fast}
                      className="space-y-4"
                    >
                      {/* User Query with demonstrative typewriter */}
                      <div className="flex justify-end">
                        <div className="max-w-md p-3 rounded-xl rounded-tr-none bg-primary text-white font-medium text-sm border-2 border-border-default shadow-neo-sm">
                          <NeoTypewriter
                            text="Why does 2-Phase Commit fail when the coordinator crashes during the prepare phase?"
                            speed={20}
                            startDelay={150}
                          />
                        </div>
                      </div>

                      {/* AI Grounded Response */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0 mt-1">
                          <Brain size={16} />
                        </div>
                        <div className="max-w-xl p-4 rounded-xl rounded-tl-none bg-surface-container border-2 border-border-default shadow-neo-sm text-sm space-y-3">
                          <p className="text-on-surface leading-relaxed">
                            In 2PC, if the coordinator crashes after participants have voted <strong>&quot;YES&quot;</strong> in the prepare phase, participants remain in an <em>in-doubt</em> state. They have locked their resources but cannot unilaterally decide whether to commit or abort until the coordinator recovers.
                          </p>
                          
                          {/* Grounded Citations Bar */}
                          <div className="pt-2 border-t border-border-default/60 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-on-surface-variant uppercase tracking-wider">Grounded Citations:</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-default text-xs font-bold text-primary hover:bg-surface-container-high cursor-pointer transition-colors shadow-neo-xs hover:shadow-none">
                              <BookOpen size={12} />
                              <span>DDIA &bull; Ch. 9 &bull; p. 356</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-default text-xs font-bold text-primary hover:bg-surface-container-high cursor-pointer transition-colors shadow-neo-xs hover:shadow-none">
                              <BookOpen size={12} />
                              <span>Section: &quot;Coordinator Failure&quot;</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeWorkflowTab === 'review' && (
                    <motion.div
                      key="review"
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={TRANSITIONS.fast}
                      className="max-w-lg mx-auto p-6 rounded-xl border-2 border-border-default bg-surface-container/30 shadow-neo space-y-4"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-primary font-black uppercase tracking-wider">FSRS Spaced Repetition Drill</span>
                        <span className="text-on-surface-variant">Stability: 4.2d &bull; Difficulty: 0.28</span>
                      </div>
                      <div className="p-4 rounded-lg bg-surface border-2 border-border-default font-bold text-base text-on-surface shadow-neo-xs">
                        How does Raft elect a new leader if the current leader&apos;s heartbeat is missed?
                      </div>
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        <button className="py-2 text-xs font-bold rounded border-2 border-border-default bg-surface hover:bg-red-500/10 text-on-surface shadow-neo-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer">
                          Again<br/><span className="text-[10px] text-on-surface-variant">10m</span>
                        </button>
                        <button className="py-2 text-xs font-bold rounded border-2 border-border-default bg-surface hover:bg-amber-500/10 text-on-surface shadow-neo-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer">
                          Hard<br/><span className="text-[10px] text-on-surface-variant">1.2d</span>
                        </button>
                        <button className="py-2 text-xs font-bold rounded border-2 border-border-default bg-surface hover:bg-blue-500/10 text-on-surface shadow-neo-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer">
                          Good<br/><span className="text-[10px] text-on-surface-variant">4d</span>
                        </button>
                        <button className="py-2 text-xs font-bold rounded border-2 border-border-default bg-surface hover:bg-emerald-500/10 text-on-surface shadow-neo-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer">
                          Easy<br/><span className="text-[10px] text-on-surface-variant">9d</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Card Footer Status */}
              <div className="px-4 py-2.5 bg-surface-container border-t-2 border-border-default flex items-center justify-between text-xs text-on-surface-variant font-medium">
                <span>Direct PDF Page Citation &bull; Zero Hallucination Retrieval</span>
                <Link to="/how-it-works" className="text-primary font-bold hover:underline inline-flex items-center gap-1">
                  <span>See Full 5-Step Pipeline</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* 2. NEO-BRUTALIST MARQUEE TICKER */}
      <NeoMarquee
        items={[
          'KNOWLEDGE CAPTURE',
          'ATOMIC CONCEPTS',
          'GROUNDED RAG',
          'PAGE CITATIONS',
          'FSRS SPACED REPETITION',
          'LOCAL-FIRST PRIVACY',
          'ZERO VENDOR LOCK-IN',
          'ACTIVE RECALL ENGINE',
        ]}
        speedSeconds={28}
      />

      {/* 3. PROBLEM → SOLUTION SECTION */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-16 md:py-24 border-b-2 border-border-default bg-surface"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <h2 className="text-xs font-black uppercase tracking-wider text-primary">The Core Problem</h2>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-on-surface">
              Passive reading creates the illusion of learning.
            </h3>
            <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed">
              When you highlight a sentence or save a PDF, your brain recognizes the information, but it doesn&apos;t encode it. Within 48 hours, Ebbinghaus&apos;s forgetting curve erases up to 70% of what you just studied.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* The Old Way */}
            <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface-container-low/60 shadow-neo space-y-4 hover:shadow-neo-lg transition-all duration-150">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400 font-black">
                &times;
              </div>
              <h4 className="text-xl font-black text-on-surface">The Fragmented Workflow</h4>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-red-500">&bull;</span>
                  <span><strong>Static Documents:</strong> Massive 500-page PDFs sit unsearched on your hard drive.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-red-500">&bull;</span>
                  <span><strong>Disconnected AI:</strong> Copying paragraphs into generic AI chatbots loses book context and invents citations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-red-500">&bull;</span>
                  <span><strong>Zero Recall:</strong> No automated mechanism to convert insights into active review cards.</span>
                </li>
              </ul>
            </div>

            {/* The Recall AI Way */}
            <div className="p-6 sm:p-8 rounded-2xl border-2 border-primary bg-primary/5 shadow-neo-lg space-y-4 hover:-translate-y-0.5 transition-all duration-150">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black border-2 border-border-default shadow-neo-sm">
                <Brain size={20} />
              </div>
              <h4 className="text-xl font-black text-on-surface">The Recall AI Learning Engine</h4>
              <ul className="space-y-3 text-sm text-on-surface">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>Structured Decomposition:</strong> Automatic chapter breakdown and atomic concept synthesis.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>Verifiable Grounding:</strong> AI answers cite the exact page and paragraph inside your document.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                  <span><strong>FSRS Spaced Repetition:</strong> Automatically surfaces flashcards at the exact moment retention is about to decay.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 4. 5-STEP WORKFLOW SECTION */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-16 md:py-24 border-b-2 border-border-default bg-surface/40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-xs font-black uppercase tracking-wider text-primary">System Architecture</h2>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-on-surface">
              From raw document to permanent working memory
            </h3>
            <p className="text-base text-on-surface-variant">
              Every piece of knowledge moves through a rigorous, scientifically grounded 5-phase pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { num: '01', title: 'Add Knowledge', desc: 'Import textbooks, research papers, or markdown lecture notes.', tag: 'PDF • EPUB • MD', primary: false },
              { num: '02', title: 'Decompose', desc: 'Extracts table of contents and generates atomic concept maps.', tag: 'Semantic Chunking', primary: false },
              { num: '03', title: 'Ask & Ground', desc: 'Interrogate your library with grounded RAG and verifiable citations.', tag: 'Page Citations', primary: false },
              { num: '04', title: 'Active Recall', desc: 'Generates diagnostic flashcards and interactive Socratic quizzes.', tag: 'Flashcards & Quizzes', primary: false },
              { num: '05', title: 'FSRS Review', desc: 'Daily review queue surfaces cards right before you forget them.', tag: 'Scientific Retention', primary: true },
            ].map((step, idx) => (
              <motion.div
                key={step.num}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={sectionViewport}
                transition={{ duration: 0.25, delay: idx * 0.06 }}
                className={`p-5 rounded-xl border-2 flex flex-col justify-between transition-all duration-150 ${
                  step.primary
                    ? 'border-primary bg-primary/5 shadow-neo hover:shadow-neo-lg'
                    : 'border-border-default bg-surface shadow-neo hover:shadow-neo-lg'
                }`}
              >
                <div className="space-y-2">
                  <span className={`text-2xl font-black font-mono ${step.primary ? 'text-primary' : 'text-primary/40'}`}>
                    {step.num}
                  </span>
                  <h4 className="font-extrabold text-on-surface text-base">{step.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className={`pt-3 border-t text-[11px] font-bold ${
                  step.primary ? 'border-primary/20 text-primary' : 'border-border-default/50 text-on-surface-variant'
                }`}>
                  {step.tag}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 5. KNOWLEDGE HUB DIFFERENTIATION */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-16 md:py-24 border-b-2 border-border-default bg-surface"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-default bg-surface-container text-xs font-bold text-primary shadow-neo-xs">
                <Search size={13} />
                <span>Strict Grounding vs. Generic Chatbots</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-on-surface leading-tight">
                An AI assistant that only speaks from your trusted sources.
              </h3>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Generic AI tools suffer from hallucination because they guess from broad internet training data. Recall AI limits its context window directly to the vector embeddings of your active document, ensuring answers are factual and referenced.
              </p>
              
              <div className="space-y-3 pt-2">
                {[
                  {
                    num: '1',
                    title: 'Click-Through Page Citations',
                    desc: 'Every claim provides a badge that highlights the exact paragraph and page in the PDF.',
                  },
                  {
                    num: '2',
                    title: 'Zero Data Model Training',
                    desc: 'Your intellectual property and notes are never used to train public foundation models.',
                  },
                  {
                    num: '3',
                    title: 'Bring Your Own Key (BYOK)',
                    desc: 'Plug in your personal OpenAI, Gemini, or Groq API keys with zero platform credit deductions.',
                  },
                ].map((item) => (
                  <div key={item.num} className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-border-default bg-surface-container/50 shadow-neo-xs hover:shadow-neo-sm transition-all duration-120">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {item.num}
                    </div>
                    <div>
                      <h5 className="font-extrabold text-sm text-on-surface">{item.title}</h5>
                      <p className="text-xs text-on-surface-variant">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Contrast Card */}
            <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface-container-high shadow-neo-lg space-y-6">
              <div className="flex items-center justify-between border-b border-border-default/60 pb-3">
                <span className="text-xs font-black uppercase text-on-surface">Grounded Retrieval Accuracy</span>
                <span className="text-xs font-bold text-primary">Recall AI RAG Engine</span>
              </div>

              <div className="p-4 rounded-xl border border-border-default bg-surface space-y-2 shadow-neo-xs">
                <span className="text-xs font-bold text-on-surface-variant">Question:</span>
                <p className="text-sm font-bold text-on-surface">&quot;What are the trade-offs of LSM-Trees compared to B-Trees for write-heavy workloads?&quot;</p>
              </div>

              <div className="p-4 rounded-xl border-2 border-primary bg-surface space-y-3 shadow-neo-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-primary uppercase">Grounded Response</span>
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Score: 0.94 Match</span>
                </div>
                <p className="text-xs text-on-surface leading-relaxed">
                  LSM-Trees provide higher write throughput because they append to an in-memory memtable and sequentially flush SSTables to disk, avoiding random in-place updates characteristic of B-Trees. However, compaction can occasionally throttle writes during peak load.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold border border-primary/20">
                    Source: DDIA &bull; p. 83-85
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold border border-border-default">
                    Chunk #12
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 6. WHO IT IS FOR */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-16 md:py-24 border-b-2 border-border-default bg-surface/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <h2 className="text-xs font-black uppercase tracking-wider text-primary">Tailored For Mastery</h2>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-on-surface">
              Built for people who cannot afford to forget.
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: FileText,
                colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                title: 'Students & Examinees',
                desc: 'Master 1,000-page medical, legal, or STEM textbooks without drowning in manual flashcard creation.',
              },
              {
                icon: Zap,
                colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                title: 'Software Engineers',
                desc: 'Ingest technical specifications, architecture RFCs, and API references for instant recall in system design.',
              },
              {
                icon: Target,
                colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                title: 'Researchers & Academics',
                desc: 'Synthesize literature reviews across dozens of research PDFs with verifiable sentence-level citations.',
              },
              {
                icon: BookOpen,
                colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                title: 'Lifelong Readers',
                desc: 'Transform non-fiction book insights into permanently retrievable mental models instead of fleeting memories.',
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={sectionViewport}
                  transition={{ duration: 0.25, delay: idx * 0.05 }}
                  className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo space-y-3 hover:shadow-neo-lg hover:-translate-y-0.5 transition-all duration-150"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border ${card.colorClass}`}>
                    <Icon size={20} />
                  </div>
                  <h4 className="font-extrabold text-on-surface text-base">{card.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {card.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* 7. PRICING PREVIEW */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-16 md:py-24 border-b-2 border-border-default bg-surface"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <h2 className="text-xs font-black uppercase tracking-wider text-primary">Transparent Monetization</h2>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-on-surface">
              Start free. Upgrade when you need high capacity.
            </h3>
            <p className="text-sm text-on-surface-variant">
              No hidden fees. Full FSRS spaced repetition is free for all users.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter Free Card */}
            <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-6 flex flex-col justify-between hover:shadow-neo-lg transition-all duration-150">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xl text-on-surface">Starter Free</h4>
                  <Badge variant="outline">Default Plan</Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-on-surface">$0</span>
                  <span className="text-sm text-on-surface-variant font-bold">/ forever</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Ideal for personal study and testing Recall AI on your foundational texts.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-on-surface pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>50 AI Credits</strong> per month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>10 Documents</strong> active library</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>50 MB</strong> cloud storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>BYOK Ready:</strong> Connect your own keys for unlimited AI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Full FSRS Spaced Repetition</span>
                  </li>
                </ul>
              </div>

              <Link to="/app" className="w-full">
                <Button variant="outline" size="md" className="w-full justify-center font-bold border-2 border-border-default shadow-neo-sm hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
                  Start Learning Free
                </Button>
              </Link>
            </div>

            {/* Pro Scholar Card */}
            <div className="p-6 sm:p-8 rounded-2xl border-2 border-primary bg-surface shadow-neo-lg space-y-6 flex flex-col justify-between relative hover:-translate-y-0.5 transition-all duration-150">
              <div className="absolute -top-3.5 right-6 px-3 py-1 bg-primary text-white text-[11px] font-black uppercase tracking-wider rounded-md border-2 border-border-default shadow-neo-sm">
                Most Popular
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xl text-on-surface">Pro Scholar</h4>
                  <Badge variant="primary">High Capacity</Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-on-surface">$15</span>
                  <span className="text-sm text-on-surface-variant font-bold">/ month</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  For active researchers, heavy readers, and students preparing for comprehensive exams.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-on-surface pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>500 AI Credits</strong> per month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>100 Documents</strong> active library</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>2 GB</strong> cloud document storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>Priority Processing</strong> for rapid chapter chunking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span><strong>Full Exports:</strong> Markdown & Anki JSON</span>
                  </li>
                </ul>
              </div>

              <Link to="/pricing" className="w-full">
                <Button variant="primary" size="md" className="w-full justify-center font-bold shadow-neo hover:shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
                  View Detailed Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 8. TRUST & ARCHITECTURE HIGHLIGHTS */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-16 md:py-20 border-b-2 border-border-default bg-surface/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto rounded-2xl border-2 border-border-default bg-surface p-6 sm:p-10 shadow-neo">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-on-surface font-extrabold text-sm">
                  <Lock size={16} className="text-primary" />
                  <span>Encrypted Storage</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Personal API keys are encrypted client-side using AES-256 GCM or secured directly in your native OS Keyring.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-on-surface font-extrabold text-sm">
                  <ShieldCheck size={16} className="text-primary" />
                  <span>Tenant Isolation</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Every workspace has strictly partitioned database tables and vector spaces with ownership authorization on every query.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-on-surface font-extrabold text-sm">
                  <RotateCcw size={16} className="text-primary" />
                  <span>Complete Deletion</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  When you delete a document, all associated embeddings, chunks, and cached cards are completely purged.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 9. FINAL CTA SECTION */}
      <motion.section 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={sectionViewport}
        transition={TRANSITIONS.slow}
        className="py-20 md:py-28 bg-surface"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-14 rounded-3xl border-2 border-border-default bg-primary text-white shadow-neo-lg text-center space-y-6">
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Ready to remember what you read?
            </h3>
            <p className="text-base sm:text-lg max-w-xl mx-auto text-white/90 font-medium leading-relaxed">
              Upload your first document in seconds. No credit card required. Experience grounded study with Recall AI today.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/app" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-surface text-on-surface border-2 border-border-default hover:bg-surface-container font-black px-8 py-3.5 shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-neo-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  <span>Launch Recall AI Workspace</span>
                  <ArrowRight size={18} className="ml-2 stroke-[3]" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.section>
    </PublicLayout>
  );
}
