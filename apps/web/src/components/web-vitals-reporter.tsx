'use client';

import { useReportWebVitals } from 'next/web-vitals';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';

const SAMPLE_RATE = 0.2;

function isSampled(): boolean {
  if (typeof window === 'undefined') return false;
  const key = '__mv_wv_sampled';
  const cached = sessionStorage.getItem(key);
  if (cached !== null) return cached === '1';
  const sampled = Math.random() < SAMPLE_RATE;
  sessionStorage.setItem(key, sampled ? '1' : '0');
  return sampled;
}

type AttrMetric = Metric & { attribution: Record<string, unknown> };

function sendAttribution(metric: AttrMetric) {
  if (!isSampled()) return;
  // biome-ignore lint/suspicious/noExplicitAny: attribution shape varies per metric
  const a = (metric.attribution ?? {}) as Record<string, any>;
  posthog.capture('web_vitals_attribution', {
    metric_name: metric.name,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
    metric_id: metric.id,
    navigation_type: metric.navigationType,
    lcp_target: a.target,
    lcp_url: a.url,
    lcp_resource_load_delay: a.resourceLoadDelay,
    lcp_element_render_delay: a.elementRenderDelay,
    inp_target: a.interactionTarget,
    inp_type: a.interactionType,
    inp_input_delay: a.inputDelay,
    inp_processing_duration: a.processingDuration,
    inp_presentation_delay: a.presentationDelay,
    inp_longest_script: a.longestScript?.entry?.sourceURL,
    cls_largest_shift_target: a.largestShiftTarget,
    cls_largest_shift_value: a.largestShiftValue,
    cls_load_state: a.loadState,
    ttfb_waiting: a.waitingDuration,
    ttfb_dns: a.dnsDuration,
    ttfb_connection: a.connectionDuration,
    ttfb_request: a.requestDuration,
    path: window.location.pathname,
  });
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!isSampled()) return;
    posthog.capture('$web_vitals', {
      $web_vitals_metric: metric.name,
      $web_vitals_value: metric.value,
      $web_vitals_rating: (metric as Metric).rating,
      $web_vitals_id: metric.id,
      $web_vitals_navigation_type: (metric as Metric).navigationType,
      path: window.location.pathname,
    });
  });

  useEffect(() => {
    const cb = (m: Metric) => sendAttribution(m as AttrMetric);
    onLCP(cb);
    onINP(cb, { durationThreshold: 40 });
    onCLS(cb);
    onTTFB(cb);
    onFCP(cb);
  }, []);

  return null;
}
