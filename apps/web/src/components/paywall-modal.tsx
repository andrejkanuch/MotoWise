'use client';

import type { PaywallConfig } from '@motovault/types';
import posthog from 'posthog-js';
import { useCallback, useEffect, useRef } from 'react';

interface PaywallModalProps {
  isOpen: boolean;
  config: PaywallConfig;
  onClose: () => void;
  onUpgradeClick: () => void;
}

export function PaywallModal({ isOpen, config, onClose, onUpgradeClick }: PaywallModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Track shown event
  useEffect(() => {
    if (isOpen) {
      posthog.capture('paywall.shown', {
        feature: config.feature,
        source: config.source,
      });
      // Focus the CTA on open
      requestAnimationFrame(() => ctaRef.current?.focus());
    }
  }, [isOpen, config.feature, config.source]);

  // Keyboard handling: Escape to close, Tab trap
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const handleCtaClick = useCallback(() => {
    posthog.capture('paywall.cta_clicked', {
      feature: config.feature,
      source: config.source,
    });
    onUpgradeClick();
  }, [config.feature, config.source, onUpgradeClick]);

  const handleDismiss = useCallback(() => {
    posthog.capture('paywall.dismissed', {
      feature: config.feature,
      source: config.source,
    });
    onClose();
  }, [config.feature, config.source, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close paywall"
        onClick={handleDismiss}
        className="absolute inset-0 cursor-default bg-neutral-950/80 backdrop-blur-sm motion-safe:animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl motion-safe:animate-[slideUp_300ms_ease-out] motion-reduce:animate-none"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Title */}
        <h2
          id="paywall-title"
          className="pr-8 text-xl font-bold tracking-tight text-neutral-50"
        >
          {config.title}
        </h2>

        {/* Value prop bullets */}
        <ul className="mt-5 space-y-3" role="list">
          {config.valuePropBullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-sm text-neutral-300">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              >
                <circle cx="10" cy="10" r="10" className="fill-amber-500/20" />
                <path
                  d="M6 10l3 3 5-5"
                  className="stroke-amber-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {/* Price */}
        <p className="mt-5 text-center text-sm text-neutral-400">
          {config.price}
        </p>

        {/* CTA */}
        <button
          ref={ctaRef}
          type="button"
          onClick={handleCtaClick}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-500 px-6 text-base font-semibold text-neutral-950 transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          Start 7-day free trial
        </button>

        {/* Secondary dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-2 flex min-h-[44px] w-full items-center justify-center text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
