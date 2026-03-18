'use client';

import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

export function GarageManagementFaq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(({ question, answer }, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={question} className="border-b border-neutral-800/50">
            <button
              type="button"
              id={`garage-faq-question-${index}`}
              onClick={() => toggle(index)}
              className={`flex w-full min-h-[44px] items-center gap-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:rounded ${
                isOpen ? 'text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              aria-expanded={isOpen}
              aria-controls={`garage-faq-answer-${index}`}
            >
              <span className="text-sm font-medium text-warm-500">
                {String(index + 1).padStart(2, '0')}.
              </span>
              <span className="text-lg font-medium">{question}</span>
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
              id={`garage-faq-answer-${index}`}
              aria-labelledby={`garage-faq-question-${index}`}
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
                  {answer}
                </div>
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
