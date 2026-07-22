import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseYobFile } from '../src/parse.ts';

const text = readFileSync(fileURLToPath(new URL('./fixtures/yob-sample.txt', import.meta.url)), 'utf8');

describe('parseYobFile', () => {
  it('parses each line into a RawRecord with the given year', () => {
    const recs = parseYobFile(text, 1985);
    expect(recs).toHaveLength(5);
    expect(recs[0]).toEqual({ name: 'Mary', sex: 'F', year: 1985, count: 7065 });
    expect(recs[2]).toEqual({ name: 'John', sex: 'M', year: 1985, count: 9655 });
  });
  it('ignores blank trailing lines', () => {
    expect(parseYobFile(text + '\n\n', 1985)).toHaveLength(5);
  });
});
