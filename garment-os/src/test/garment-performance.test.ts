import { describe,expect,it } from 'vitest';
import { downgradeGarmentPerformance,performanceProfile } from '@/features/piece-library/garment-performance';

describe('garment performance tiers',()=>{
  it('downgrades without changing the renderer contract',()=>{
    const high=performanceProfile('high'),balanced=downgradeGarmentPerformance(high),compatibility=downgradeGarmentPerformance(balanced);
    expect(high.tier).toBe('high');expect(balanced.tier).toBe('balanced');expect(compatibility.tier).toBe('compatibility');
    expect(compatibility.pixelBudget).toBeLessThan(balanced.pixelBudget);expect(compatibility.shadows).toBe(false);
  });
  it('keeps the final tier stable',()=>expect(downgradeGarmentPerformance(performanceProfile('compatibility'))).toBe(performanceProfile('compatibility')));
});
