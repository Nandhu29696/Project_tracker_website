import { describe, expect, it } from 'vitest';
import { computeHealth, type HealthInput } from './schemas/insights';

const base: HealthInput = {
  status: 'ACTIVE',
  targetDate: '2027-01-31',
  today: '2026-11-18',
  openItems: 20,
  overdueItems: 0,
  openCriticalBugs: 0,
  openHighBugs: 0,
  sprintBurnRatio: 1,
};

describe('project health', () => {
  it('is on track with no warning signs', () => {
    expect(computeHealth(base)).toEqual({ state: 'ON_TRACK', reasons: [] });
  });

  it('closed projects have no health', () => {
    expect(computeHealth({ ...base, status: 'COMPLETED', targetDate: '2020-01-01' }).state).toBe(
      'DONE',
    );
  });

  it('a passed target date is off track', () => {
    const h = computeHealth({ ...base, targetDate: '2026-11-01' });
    expect(h.state).toBe('OFF_TRACK');
    expect(h.reasons).toContain('Target date has passed');
  });

  it('one critical bug is a risk, two are off track', () => {
    expect(computeHealth({ ...base, openCriticalBugs: 1 }).state).toBe('AT_RISK');
    expect(computeHealth({ ...base, openCriticalBugs: 2 }).state).toBe('OFF_TRACK');
  });

  it('overdue share decides between risk and off track', () => {
    expect(computeHealth({ ...base, overdueItems: 2 }).state).toBe('AT_RISK');
    expect(computeHealth({ ...base, overdueItems: 5 }).state).toBe('OFF_TRACK');
    // a small project with 1 of 3 overdue is at risk, not off track
    expect(computeHealth({ ...base, openItems: 3, overdueItems: 1 }).state).toBe('AT_RISK');
  });

  it('a sprint behind its burndown is flagged; reasons explain everything', () => {
    const h = computeHealth({ ...base, sprintBurnRatio: 1.3, status: 'ON_HOLD' });
    expect(h.state).toBe('AT_RISK');
    expect(h.reasons).toEqual(['Active sprint is behind its burndown', 'Project is on hold']);
  });
});
