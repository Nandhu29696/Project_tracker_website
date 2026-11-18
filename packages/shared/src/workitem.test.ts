import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PARENTS,
  canTransition,
  createWorkItemSchema,
  listWorkItemsQuerySchema,
  nextStates,
  OPEN_STATES,
  statesForType,
  tagsSchema,
  WORK_ITEM_TYPES,
  WORKFLOWS,
} from './schemas/workitem';

describe('work item workflows', () => {
  it('every transition target is a state of that type', () => {
    for (const type of WORK_ITEM_TYPES) {
      const states = statesForType(type);
      expect(states).toContain(WORKFLOWS[type].initial);
      for (const s of states)
        for (const next of nextStates(type, s)) expect(states).toContain(next);
    }
  });

  it('tasks use To Do / In Progress / Done', () => {
    expect(statesForType('TASK')).toEqual(['TODO', 'IN_PROGRESS', 'DONE', 'REMOVED']);
    expect(canTransition('TASK', 'TODO', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('TASK', 'TODO', 'ACTIVE')).toBe(false);
  });

  it('bugs must be resolved before they can be verified', () => {
    expect(canTransition('BUG', 'NEW', 'VERIFIED')).toBe(false);
    expect(canTransition('BUG', 'RESOLVED', 'VERIFIED')).toBe(true);
    expect(canTransition('BUG', 'CLOSED', 'ACTIVE')).toBe(true); // reopen
  });

  it('open states are proposed + in progress only', () => {
    expect(OPEN_STATES).toEqual(['NEW', 'TRIAGED', 'TODO', 'ACTIVE', 'IN_PROGRESS']);
  });
});

describe('hierarchy', () => {
  it('levels strictly decrease, so no cycles are possible', () => {
    const level = { EPIC: 0, FEATURE: 1, STORY: 2, BUG: 3, TASK: 4 } as const;
    for (const type of WORK_ITEM_TYPES) {
      for (const parent of ALLOWED_PARENTS[type]) expect(level[parent]).toBeLessThan(level[type]);
    }
    expect(ALLOWED_PARENTS.EPIC).toEqual([]);
  });
});

describe('work item schemas', () => {
  it('normalises tags', () => {
    expect(tagsSchema.parse(['UI', 'ui', ' Backend '])).toEqual(['ui', 'backend']);
    expect(() => tagsSchema.parse(['a,b'])).toThrow();
  });

  it('validates due date order on create', () => {
    const base = { type: 'TASK', title: 'Write tests' } as const;
    expect(
      createWorkItemSchema.safeParse({ ...base, startDate: '2026-02-01', dueDate: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(createWorkItemSchema.parse({ ...base, assigneeId: '' }).assigneeId).toBeNull();
  });

  it('accepts comma separated filters', () => {
    const q = listWorkItemsQuerySchema.parse({ type: 'BUG,TASK', status: 'open' });
    expect(q.type).toEqual(['BUG', 'TASK']);
    expect(listWorkItemsQuerySchema.safeParse({ type: 'BUG,NOPE' }).success).toBe(false);
  });
});
