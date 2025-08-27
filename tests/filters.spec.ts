import { describe, it, expect } from 'vitest';
import { parseFilterDSL, shouldInclude } from '../src/filters/dsl.js';

describe('Filter DSL', () => {
  it('includes by default when no filters', () => {
    expect(shouldInclude('/a','GET',[])).toBe(true);
  });
  it('applies include/exclude precedence', () => {
    const filters = parseFilterDSL('+/**;-/admin/**');
    expect(shouldInclude('/public','GET',filters)).toBe(true);
    expect(shouldInclude('/admin/x','GET',filters)).toBe(false);
  });
});
