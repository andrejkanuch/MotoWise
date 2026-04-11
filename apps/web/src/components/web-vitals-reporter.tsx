'use client';

/**
 * Core Web Vitals reporter — single subscription via `web-vitals/attribution`
 * (NOT `next/web-vitals`, to avoid double-subscription). Fires one
 * `$web_vitals` event per metric for PostHog's built-in dashboard, plus one
 * richer `web_vitals_attribution` event per sampled session.
 *
 * Sampling is 20% deterministic per browser (localStorage-keyed), so two tabs
 * from the same user land in the same bucket and per-session analysis stays
 * consistent.
 */

import posthog from 'posthog-js';
import { useEffect } from 'react';
import {
  type CLSMetricWithAttribution,
  type FCPMetricWithAttribution,
  type INPMetricWithAttribution,
  type LCPMetricWithAttribution,
  type Metric,
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
  type TTFBMetricWithAttribution,
} from 'web-vitals/attribution';

const SAMPLE_RATE = 0.2;
const SAMPLE_KEY = '__mv_wv_sampled';

function isSampled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cached = localStorage.getItem(SAMPLE_KEY);
    if (cached !== null) return cached === '1';
    const sampled = Math.random() < SAMPLE_RATE;
    localStorage.setItem(SAMPLE_KEY, sampled ? '1' : '0');
    return sampled;
  } catch {
    // localStorage can throw in private browsing; fall through to per-page sample.
    return Math.random() < SAMPLE_RATE;
  }
}

type AttrMetric =
  | LCPMetricWithAttribution
  | INPMetricWithAttribution
  | CLSMetricWithAttribution
  | TTFBMetricWithAttribution
  | FCPMetricWithAttribution;

function sendMetric(metric: AttrMetric) {
  if (!isSampled()) return;

  // Primary PostHog built-in Web Vitals dashboard event.
  posthog.capture('$web_vitals', {
    $web_vitals_metric: metric.name,
    $web_vitals_value: metric.value,
    $web_vitals_rating: (metric as Metric).rating,
    $web_vitals_id: metric.id,
    $web_vitals_navigation_type: (metric as Metric).navigationType,
    path: window.location.pathname,
  });

  // Rich attribution event for debugging — separate from $web_vitals so
  // we don't clobber PostHog's own web-vitals dashboard schema.
  const base = {
    metric_name: metric.name,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: (metric as Metric).rating,
    metric_id: metric.id,
    navigation_type: (metric as Metric).navigationType,
    path: window.location.pathname,
  };
  let extra: Record<string, unknown> = {};
  switch (metric.name) {
    case 'LCP': {
      const a = metric.attribution;
      extra = {
        lcp_target: a.target,
        lcp_url: a.url,
        lcp_resource_load_delay: a.resourceLoadDelay,
        lcp_element_render_delay: a.elementRenderDelay,
      };
      break;
    }
    case 'INP': {
      const a = metric.attribution;
      extra = {
        inp_target: a.interactionTarget,
        inp_type: a.interactionType,
        inp_input_delay: a.inputDelay,
        inp_processing_duration: a.processingDuration,
        inp_presentation_delay: a.presentationDelay,
        inp_longest_script: a.longestScript?.entry?.sourceURL,
      };
      break;
    }
    case 'CLS': {
      const a = metric.attribution;
      extra = {
        cls_largest_shift_target: a.largestShiftTarget,
        cls_largest_shift_value: a.largestShiftValue,
        cls_load_state: a.loadState,
      };
      break;
    }
    case 'TTFB': {
      const a = metric.attribution;
      extra = {
        ttfb_waiting: a.waitingDuration,
        ttfb_dns: a.dnsDuration,
        ttfb_connection: a.connectionDuration,
        ttfb_request: a.requestDuration,
      };
      break;
    }
    case 'FCP':
      // FCP attribution in v5 is minimal — no extras beyond base.
      break;
  }
  posthog.capture('web_vitals_attribution', { ...base, ...extra });
}

export function WebVitalsReporter() {
  useEffect(() => {
    onLCP(sendMetric);
    onINP(sendMetric, { durationThreshold: 40 });
    onCLS(sendMetric);
    onTTFB(sendMetric);
    onFCP(sendMetric);
  }, []);

  return null;
}
