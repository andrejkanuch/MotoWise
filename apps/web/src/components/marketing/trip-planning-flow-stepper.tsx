'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TripFlowStep {
  number: string;
  label: string;
  title: string;
  description: string;
  screenshot: string;
  alt: string;
}

interface TripPlanningFlowStepperProps {
  sectionLabel: string;
  sectionTitle: string;
  steps: TripFlowStep[];
}

// Progressive timing — a touch slower than the diagnostic stepper because trip content is denser
const STEP_DURATIONS = [6000, 5500, 5000, 5000];

export function TripPlanningFlowStepper({
  sectionLabel,
  sectionTitle,
  steps,
}: TripPlanningFlowStepperProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    timerRef.current = null;
    progressRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    clearTimers();
    setTimerProgress(0);

    const advance = (stepIndex: number) => {
      const duration = STEP_DURATIONS[stepIndex] ?? 5000;
      let elapsed = 0;
      const tick = 50;

      progressRef.current = setInterval(() => {
        elapsed += tick;
        setTimerProgress(Math.min(elapsed / duration, 1));
      }, tick);

      timerRef.current = setTimeout(() => {
        setTimerProgress(0);
        const next = (stepIndex + 1) % steps.length;
        setActiveStep(next);
        if (progressRef.current) clearInterval(progressRef.current);
        advance(next);
      }, duration);
    };

    advance(activeStep);
  }, [steps.length, clearTimers, activeStep]);

  useEffect(() => {
    if (isInView && !hasInteracted) startTimer();
    return clearTimers;
  }, [isInView, hasInteracted, startTimer, clearTimers]);

  function handleStepClick(index: number) {
    setHasInteracted(true);
    setActiveStep(index);
    setTimerProgress(0);
    clearTimers();
  }

  const circumference = 2 * Math.PI * 11;
  const strokeDashoffset = circumference * (1 - timerProgress);
  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <section ref={containerRef} className="relative px-6 py-24">
      {/* Faint topographic lines background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'><g fill='none' stroke='%23e6b85e' stroke-width='0.6'><path d='M0 120 Q120 80 240 140 T480 100'/><path d='M0 180 Q140 150 260 200 T480 170'/><path d='M0 240 Q100 210 220 260 T480 230'/><path d='M0 300 Q160 270 280 320 T480 290'/><path d='M0 360 Q120 330 240 380 T480 350'/></g></svg>\")",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="reveal-on-scroll mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {sectionLabel}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {sectionTitle}
          </h2>
        </div>

        {/* Progress + Step pills */}
        <div className="mb-12 flex flex-col items-center gap-6">
          <div className="h-1 w-full max-w-lg overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-warm-400 to-signature-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {steps.map((step, i) => {
              const isActive = activeStep === i;
              const isCompleted = activeStep > i;
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
                  aria-current={isActive ? 'step' : undefined}
                >
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
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
          {/* Phone mockup with screenshot crossfade */}
          <div className="relative w-[260px] shrink-0 md:w-[300px]">
            <div className="phone-float relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-neutral-700/50">
              <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />

              <div
                className="relative overflow-hidden rounded-[2rem]"
                style={{ aspectRatio: '1206/2322' }}
              >
                {steps.map((step, i) => (
                  <Image
                    key={step.screenshot}
                    src={step.screenshot}
                    alt={step.alt}
                    width={1206}
                    height={2322}
                    className={`absolute inset-0 block w-full transition-all duration-500 ${
                      activeStep === i
                        ? 'opacity-100 scale-100'
                        : 'pointer-events-none opacity-0 scale-[0.98]'
                    }`}
                    sizes="300px"
                    priority={i === 0}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ))}
              </div>

              <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-neutral-700" />
            </div>

            <div
              className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.76 0.13 70 / 0.15), transparent)',
              }}
              aria-hidden="true"
            />
          </div>

          {/* Step text + waypoint strip */}
          <div className="flex-1 text-center md:text-left">
            <div key={`step-${activeStep}`} className="animate-fade-in">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
                Step {steps[activeStep].number} of {steps.length}
              </p>
              <h3 className="text-2xl font-bold leading-tight tracking-tight text-neutral-50 sm:text-3xl">
                {steps[activeStep].title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-neutral-400">
                {steps[activeStep].description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
