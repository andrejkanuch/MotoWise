'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

interface FlowStep {
  number: string;
  label: string;
  title: string;
  description: string;
  screenshot: string;
  alt: string;
}

interface DiagnosticFlowStepperProps {
  sectionLabel: string;
  sectionTitle: string;
  steps: FlowStep[];
  result: {
    title: string;
    description: string;
    screenshots: { src: string; alt: string }[];
  };
}

// Progressive timing — longer on first step, faster as momentum builds
const STEP_DURATIONS = [5500, 4500, 4000, 3500];

export function DiagnosticFlowStepper({
  sectionLabel,
  sectionTitle,
  steps,
  result,
}: DiagnosticFlowStepperProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intersection observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), {
      threshold: 0.3,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    timerRef.current = null;
    progressRef.current = null;
  }, []);

  // Auto-advance with progressive timing
  const startTimer = useCallback(() => {
    clearTimers();
    setTimerProgress(0);

    const advance = (stepIndex: number) => {
      const duration = STEP_DURATIONS[stepIndex] ?? 4000;
      let elapsed = 0;
      const progressInterval = 50;

      progressRef.current = setInterval(() => {
        elapsed += progressInterval;
        setTimerProgress(Math.min(elapsed / duration, 1));
      }, progressInterval);

      timerRef.current = setTimeout(() => {
        setTimerProgress(0);
        if (stepIndex < steps.length - 1) {
          setActiveStep(stepIndex + 1);
          if (progressRef.current) clearInterval(progressRef.current);
          advance(stepIndex + 1);
        } else {
          setShowResult(true);
          clearTimers();
        }
      }, duration) as unknown as ReturnType<typeof setInterval>;
    };

    advance(activeStep);
  }, [steps.length, clearTimers, activeStep]);

  useEffect(() => {
    if (isInView && !hasInteracted && !showResult) {
      startTimer();
    }
    return clearTimers;
  }, [isInView, hasInteracted, showResult, startTimer, clearTimers]);

  function handleStepClick(index: number) {
    setHasInteracted(true);
    setShowResult(false);
    setActiveStep(index);
    setTimerProgress(0);
    clearTimers();
  }

  function handleResultClick() {
    setHasInteracted(true);
    setShowResult(true);
    setTimerProgress(0);
    clearTimers();
  }

  const totalSteps = steps.length;
  const progress = showResult ? 100 : ((activeStep + 1) / (totalSteps + 1)) * 100;

  // SVG circular progress for active pill
  const circumference = 2 * Math.PI * 11; // r=11 for a 24px circle
  const strokeDashoffset = circumference * (1 - timerProgress);

  return (
    <section ref={containerRef} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {sectionLabel}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {sectionTitle}
          </h2>
        </div>

        {/* Step navigation pills */}
        <div className="mb-12 flex flex-col items-center gap-6">
          {/* Progress bar */}
          <div className="h-1 w-full max-w-lg overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-warm-400 to-signature-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {steps.map((step, i) => {
              const isActive = !showResult && activeStep === i;
              const isCompleted = !showResult && activeStep > i;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => handleStepClick(i)}
                  className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-warm-500/15 text-warm-400 ring-1 ring-warm-500/30'
                      : isCompleted
                        ? 'bg-neutral-800/50 text-neutral-300'
                        : 'bg-neutral-900/50 text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
                  }`}
                >
                  {/* Number circle with optional timer ring */}
                  <span className="relative">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        isActive
                          ? 'bg-warm-500 text-neutral-950'
                          : isCompleted
                            ? 'bg-neutral-600 text-neutral-300'
                            : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {isCompleted ? (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </span>
                    {/* Timer ring on active pill during auto-play */}
                    {isActive && !hasInteracted && (
                      <svg
                        className="pointer-events-none absolute -inset-0.5"
                        width="28"
                        height="28"
                        viewBox="0 0 28 28"
                        aria-hidden="true"
                      >
                        <circle
                          cx="14"
                          cy="14"
                          r="11"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className="text-warm-400/40"
                          style={{
                            strokeDasharray: circumference,
                            strokeDashoffset,
                            transform: 'rotate(-90deg)',
                            transformOrigin: 'center',
                            transition: 'stroke-dashoffset 50ms linear',
                          }}
                        />
                      </svg>
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}

            {/* Result pill */}
            <button
              type="button"
              onClick={handleResultClick}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                showResult
                  ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30'
                  : 'bg-neutral-900/50 text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs transition-all duration-300 ${
                  showResult ? 'bg-accent-500 text-neutral-950' : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
                </svg>
              </span>
              <span className="hidden sm:inline">Result</span>
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
          {/* Phone mockup */}
          <div className="relative w-[260px] shrink-0 md:w-[300px]">
            <div className="phone-float relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-neutral-700/50">
              {/* Dynamic Island */}
              <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />

              {/* Screen with crossfade */}
              <div
                className="relative overflow-hidden rounded-[2rem]"
                style={{ aspectRatio: '1206/2622' }}
              >
                {steps.map((step, i) => (
                  <Image
                    key={step.screenshot}
                    src={step.screenshot}
                    alt={step.alt}
                    width={1206}
                    height={2622}
                    className={`absolute inset-0 block w-full transition-all duration-500 ${
                      !showResult && activeStep === i
                        ? 'opacity-100 scale-100'
                        : 'pointer-events-none opacity-0 scale-[0.98]'
                    }`}
                    sizes="300px"
                    priority={i === 0}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ))}
                {/* Result screenshot */}
                <Image
                  src={result.screenshots[0].src}
                  alt={result.screenshots[0].alt}
                  width={1206}
                  height={2622}
                  className={`absolute inset-0 block w-full transition-all duration-500 ${
                    showResult
                      ? 'opacity-100 scale-100'
                      : 'pointer-events-none opacity-0 scale-[0.98]'
                  }`}
                  sizes="300px"
                  loading="lazy"
                />
              </div>

              {/* Home indicator */}
              <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-neutral-700" />
            </div>

            {/* Glow effect */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 blur-3xl transition-all duration-700"
              style={{
                background: showResult
                  ? 'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.6 0.15 150 / 0.15), transparent)'
                  : 'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.17 230 / 0.12), transparent)',
              }}
              aria-hidden="true"
            />
          </div>

          {/* Text content */}
          <div className="flex-1 text-center md:text-left">
            {!showResult ? (
              <div key={`step-${activeStep}`} className="animate-fade-in">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
                  Step {steps[activeStep].number} of {totalSteps}
                </p>
                <h3 className="text-2xl font-bold leading-tight tracking-tight text-neutral-50 sm:text-3xl">
                  {steps[activeStep].title}
                </h3>
                <p className="mt-4 text-lg leading-relaxed text-neutral-400">
                  {steps[activeStep].description}
                </p>
              </div>
            ) : (
              <div key="result" className="animate-fade-in">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
                  AI Analysis Complete
                </p>
                <h3 className="text-2xl font-bold leading-tight tracking-tight text-neutral-50 sm:text-3xl">
                  {result.title}
                </h3>
                <p className="mt-4 text-lg leading-relaxed text-neutral-400">
                  {result.description}
                </p>

                {/* Result highlights */}
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Part Identified',
                      icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
                    },
                    {
                      label: 'Severity Rating',
                      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
                    },
                    {
                      label: 'Issues & Probability',
                      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                    },
                    {
                      label: 'Next Steps',
                      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
                    },
                  ].map(({ label, icon }, i) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-4 py-3 transition-colors hover:border-accent-500/20"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-accent-400"
                          aria-hidden="true"
                        >
                          <path d={icon} />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-neutral-300">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
