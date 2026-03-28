'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

const FAQ_KEYS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const t = useTranslations('Faq');

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="px-6 py-24 lg:py-28">
      <div className="mx-auto max-w-4xl">
        {/* Decorative rule */}
        <div
          className="mx-auto mb-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
          aria-hidden="true"
        />

        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('sectionLabel')}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('sectionTitle')}
          </h2>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-2">
          {FAQ_KEYS.map((index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="border-b border-neutral-800/50">
                <button
                  type="button"
                  id={`faq-question-${index}`}
                  onClick={() => toggle(index)}
                  className={`flex w-full min-h-[44px] items-center gap-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:rounded ${
                    isOpen ? 'text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-sm font-medium text-warm-500">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="text-lg font-medium">{t(`items.${index}.question`)}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`ml-auto shrink-0 text-neutral-500 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Accordion body with grid-rows animation */}
                <section
                  id={`faq-answer-${index}`}
                  aria-labelledby={`faq-question-${index}`}
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                  }}
                >
                  <div className="overflow-hidden">
                    <div
                      className="faq-accent-line pb-4 pl-4 text-base leading-7 text-neutral-300 transition-opacity duration-300 lg:max-w-2xl"
                      data-open={isOpen}
                      style={{
                        opacity: isOpen ? 1 : 0,
                        transitionDelay: isOpen ? '100ms' : '0ms',
                      }}
                    >
                      {t(`items.${index}.answer`)}
                    </div>
                  </div>
                </section>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
