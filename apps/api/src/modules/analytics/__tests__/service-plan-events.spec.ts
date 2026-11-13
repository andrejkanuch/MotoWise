import { describe, expect, it } from 'vitest';
import {
  buildServicePlanImportedEvent,
  SERVICE_PLAN_IMPORTED_EVENT,
  SERVICE_PLAN_NO_CONSENT_DISTINCT_ID,
  SERVICE_PLAN_SOURCE,
} from '../service-plan-events';

const USER_ID = 'user-123';
const BASE = {
  userId: USER_ID,
  tier: 'model',
  taskCount: 9,
  unit: 'mi',
  source: SERVICE_PLAN_SOURCE.ONBOARDING,
} as const;

describe('buildServicePlanImportedEvent (activation T07a consent rule)', () => {
  it('a stored "yes" identifies the rider', () => {
    const event = buildServicePlanImportedEvent({ ...BASE, decision: true });
    expect(event.event).toBe(SERVICE_PLAN_IMPORTED_EVENT);
    expect(event.distinct_id).toBe(USER_ID);
    expect(event.properties).toMatchObject({
      tier: 'model',
      task_count: 9,
      unit: 'mi',
      source: 'onboarding',
      $geoip_disable: true,
    });
    expect(event.properties).not.toHaveProperty('$process_person_profile');
  });

  it.each([
    ['a stored "no"', false],
    ['no decision stored yet', null],
    ['an unreadable decision', undefined],
  ])('%s sends a constant, non-identifying distinct_id and no user id anywhere', (_, decision) => {
    const event = buildServicePlanImportedEvent({ ...BASE, decision });
    expect(event.distinct_id).toBe(SERVICE_PLAN_NO_CONSENT_DISTINCT_ID);
    expect(event.properties).toMatchObject({
      $process_person_profile: false,
      analytics_consent: false,
    });
    expect(JSON.stringify(event)).not.toContain(USER_ID);
  });

  it('never carries an email or other personal field', () => {
    const event = buildServicePlanImportedEvent({ ...BASE, decision: true });
    expect(Object.keys(event.properties).sort()).toEqual(
      ['$geoip_disable', 'source', 'task_count', 'tier', 'unit'].sort(),
    );
  });
});
