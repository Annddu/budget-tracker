import { z } from 'zod';

export const OverviewSchema = z.object({
  year: z.coerce.number().int().positive(),
  month: z.coerce.number().int().min(1).max(12)
});

export type OverviewRequest = z.infer<typeof OverviewSchema>;

describe('Overview Schema', () => {
  it('should validate a valid overview request', () => {
    const validData = {
      year: 2023,
      month: 5
    };

    const result = OverviewSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate with string inputs and convert them to numbers', () => {
    const stringData = {
      year: '2023',
      month: '5'
    };

    const result = OverviewSchema.safeParse(stringData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        year: 2023,
        month: 5
      });
    }
  });

  it('should reject invalid month values', () => {
    const invalidMonthData = {
      year: 2023,
      month: 13 // Invalid month (should be 1-12)
    };

    const result = OverviewSchema.safeParse(invalidMonthData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('month');
    }
  });

  it('should reject invalid year values', () => {
    const invalidYearData = {
      year: -1, // Invalid year
      month: 5
    };

    const result = OverviewSchema.safeParse(invalidYearData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('year');
    }
  });
});