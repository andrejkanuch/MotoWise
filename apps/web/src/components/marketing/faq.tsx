'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const t = useTranslations('Faq');
  const items = t.raw('items') as Array<{ question: string; answer: string }>;

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="px-4 py-24">
      <div className="mx-auto max-w-4xl">
        {/* Section header */}
        <h2 className="reveal-on-scroll mb-16 text-center text-3xl font-bold tracking-tight text-neutral-50 md:text-4xl">
          {t('sectionTitle')}
        </h2>

        {/* Responsive accordion */}
        <div className="flex flex-col gap-2">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="border-b border-neutral-800">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className={`flex w-full items-center gap-3 py-4 text-left transition-colors ${
                    isOpen ? 'text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-sm font-medium text-accent-500">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="font-medium">{item.question}</span>
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
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                  }}
                >
                  <div className="overflow-hidden">
                    <div
                      className="pb-4 text-base leading-relaxed text-neutral-300 transition-opacity duration-300 lg:max-w-2xl"
                      style={{
                        opacity: isOpen ? 1 : 0,
                        transitionDelay: isOpen ? '100ms' : '0ms',
                      }}
                    >
                      {item.answer}
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
