import { Injectable } from '@nestjs/common';

export interface FuelRangeSummary {
  effectiveRangeKm: number;
  text: string;
}

@Injectable()
export class FuelStopsService {
  /**
   * Calculate effective range: tankLiters * efficiencyKmPerLiter * 0.8 (safety margin)
   */
  calculateEffectiveRange(tankLiters: number, efficiencyKmPerLiter: number): number {
    return tankLiters * efficiencyKmPerLiter * 0.8;
  }

  /**
   * Build a human-readable fuel range summary
   */
  computeFuelRangeSummary(
    tankLiters: number,
    efficiencyKmPerLiter: number,
  ): FuelRangeSummary {
    const effectiveRangeKm = this.calculateEffectiveRange(tankLiters, efficiencyKmPerLiter);
    const roundedRange = Math.round(effectiveRangeKm);

    const text = `Estimated range: ${roundedRange} km (${tankLiters}L tank, ${efficiencyKmPerLiter} km/L, 80% safety margin)`;

    return {
      effectiveRangeKm,
      text,
    };
  }
}
