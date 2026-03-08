'use client';

import { useState } from 'react';
import { FAQ_DATA } from './faq-data';

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <h2 className="reveal-on-scroll mb-16 text-center text-3xl font-bold tracking-tight text-neutral-50 md:text-4xl">
          Frequently Asked Questions
        </h2>

        {/* Desktop: two-column layout */}
        <div className="hidden lg:grid lg:grid-cols-[2fr_3fr] lg:gap-12">
          {/* Left column: question buttons */}
          <div className="flex flex-col gap-1">
            {FAQ_DATA.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => toggle(index)}
                  className={`group relative cursor-pointer border-l-[3px] py-4 pl-5 pr-3 text-left transition-colors ${
                    isOpen
                      ? 'border-accent-500 text-neutral-50'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                  style={{
                    borderImageSource: isOpen ? undefined : 'none',
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-desktop-${index}`}
                >
                  <span
                    className="absolute left-0 top-0 h-full w-[3px] origin-top bg-accent-500 transition-transform duration-300"
                    style={{
                      transform: isOpen ? 'scaleY(1)' : 'scaleY(0)',
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-accent-500">
                    {String(index + 1).padStart(2, '0')}.
                  </span>{' '}
                  <span className="font-medium">{item.question}</span>
                </button>
              );
            })}
          </div>

          {/* Right column: expanded answer */}
          <div className="flex items-start pt-4">
            {FAQ_DATA.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <section
                  key={item.question}
                  id={`faq-answer-desktop-${index}`}
                  className="w-full"
                  style={{
                    display: isOpen ? 'block' : 'none',
                  }}
                >
                  <div
                    className="transition-opacity duration-300"
                    style={{
                      opacity: isOpen ? 1 : 0,
                      transitionDelay: isOpen ? '100ms' : '0ms',
                    }}
                  >
                    <p className="text-base leading-relaxed text-neutral-300">{item.answer}</p>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Mobile: stacked accordion */}
        <div className="flex flex-col gap-2 lg:hidden">
          {FAQ_DATA.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="border-b border-neutral-800">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-center gap-3 py-4 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-mobile-${index}`}
                >
                  <span className="text-sm font-medium text-accent-500">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span
                    className={`font-medium transition-colors ${
                      isOpen ? 'text-neutral-50' : 'text-neutral-400'
                    }`}
                  >
                    {item.question}
                  </span>
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
                  id={`faq-answer-mobile-${index}`}
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                  }}
                >
                  <div className="overflow-hidden">
                    <div
                      className="pb-4 transition-opacity duration-300"
                      style={{
                        opacity: isOpen ? 1 : 0,
                        transitionDelay: isOpen ? '100ms' : '0ms',
                      }}
                    >
                      <p className="text-base leading-relaxed text-neutral-300">{item.answer}</p>
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
