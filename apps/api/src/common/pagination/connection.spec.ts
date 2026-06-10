import { describe, expect, it } from 'vitest';
import { buildConnection, clampFirst, decodeCursor, encodeCursor } from './connection';

const ISO_TS = '2026-01-01T10:00:00.000Z';
const ISO_DATE = '2026-01-01';
const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee2222ffff';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a composite (timestamp, id) cursor', () => {
    const cursor = encodeCursor(ISO_TS, UUID);
    expect(decodeCursor(cursor)).toEqual([ISO_TS, UUID]);
  });

  it('round-trips a date-only composite cursor', () => {
    const cursor = encodeCursor(ISO_DATE, UUID);
    expect(decodeCursor(cursor)).toEqual([ISO_DATE, UUID]);
  });

  it('still parses a legacy single-field timestamp cursor (old mobile bundles)', () => {
    // Old bundles encoded just the timestamp, no UUID — must not throw or reject.
    const cursor = Buffer.from(ISO_TS).toString('base64');
    expect(decodeCursor(cursor)).toEqual([ISO_TS]);
  });

  it('parses a legacy single-field date-only cursor', () => {
    const cursor = encodeCursor(ISO_DATE);
    expect(decodeCursor(cursor)).toEqual([ISO_DATE]);
  });

  it('rejects a malformed (non-base64-ish garbage) cursor as null', () => {
    // base64 of a string that decodes to something that isn't date/uuid shaped
    const cursor = Buffer.from('not-a-cursor').toString('base64');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('rejects an empty cursor as null', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('rejects a SQL-injection attempt embedded in a cursor part', () => {
    const injection = `${ISO_TS},id.eq.0));drop table rides;--`;
    const cursor = encodeCursor(injection);
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('rejects an injection in the id half of a composite cursor', () => {
    const cursor = encodeCursor(ISO_TS, `${UUID}) or true--`);
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('rejects a part that is neither a date nor a uuid', () => {
    const cursor = encodeCursor(ISO_TS, 'not-a-uuid');
    expect(decodeCursor(cursor)).toBeNull();
  });
});

describe('clampFirst', () => {
  it('clamps above the default max of 50', () => {
    expect(clampFirst(1000)).toBe(50);
  });

  it('respects a custom max', () => {
    expect(clampFirst(1000, 20)).toBe(20);
  });

  it('passes through an in-range value', () => {
    expect(clampFirst(15)).toBe(15);
  });

  it('floors a non-positive request to 1', () => {
    expect(clampFirst(0)).toBe(1);
    expect(clampFirst(-5)).toBe(1);
  });

  it('handles NaN by flooring to 1', () => {
    expect(clampFirst(Number.NaN)).toBe(1);
  });
});

describe('buildConnection', () => {
  type Row = { id: string; ts: string };
  const mapNode = (r: Row) => ({ nodeId: r.id });
  const cursorOf = (r: Row) => encodeCursor(r.ts, r.id);

  const makeRows = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${UUID.slice(0, -1)}${i}`, ts: ISO_TS }));

  it('reports hasNextPage=true and drops the +1 row when over the limit', () => {
    const rows = makeRows(4); // limit 3 → fetched 4
    const conn = buildConnection({ rows, limit: 3, mapNode, cursorOf });
    expect(conn.pageInfo.hasNextPage).toBe(true);
    expect(conn.edges).toHaveLength(3);
  });

  it('reports hasNextPage=false and keeps all rows when at/under the limit', () => {
    const rows = makeRows(3); // limit 3 → fetched exactly 3
    const conn = buildConnection({ rows, limit: 3, mapNode, cursorOf });
    expect(conn.pageInfo.hasNextPage).toBe(false);
    expect(conn.edges).toHaveLength(3);
  });

  it('emits endCursor from the last edge and maps nodes via mapNode', () => {
    const rows = makeRows(2);
    const conn = buildConnection({ rows, limit: 3, mapNode, cursorOf });
    expect(conn.edges[0].node).toEqual({ nodeId: rows[0].id });
    expect(conn.pageInfo.endCursor).toBe(cursorOf(rows[1]));
  });

  it('omits totalCount on the forward-only overload', () => {
    const rows = makeRows(2);
    const conn = buildConnection({ rows, limit: 3, mapNode, cursorOf });
    expect('totalCount' in conn).toBe(false);
  });

  it('emits totalCount + backward markers on the counted overload', () => {
    const rows = makeRows(2);
    const conn = buildConnection({
      rows,
      limit: 3,
      mapNode,
      cursorOf,
      totalCount: 42,
      hasPreviousPage: true,
    });
    expect(conn.totalCount).toBe(42);
    expect(conn.pageInfo.hasPreviousPage).toBe(true);
    expect(conn.pageInfo.startCursor).toBe(cursorOf(rows[0]));
    expect(conn.pageInfo.endCursor).toBe(cursorOf(rows[1]));
  });

  it('handles an empty result set', () => {
    const conn = buildConnection({ rows: [], limit: 3, mapNode, cursorOf });
    expect(conn.edges).toHaveLength(0);
    expect(conn.pageInfo.hasNextPage).toBe(false);
    expect(conn.pageInfo.endCursor).toBeUndefined();
  });
});
