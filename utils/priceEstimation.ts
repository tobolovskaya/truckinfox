export interface PriceRangeEstimate {
  min: number | null;
  max: number | null;
  distanceKm: number | null;
}

const CARGO_PRICE_FACTORS: Record<string, number> = {
  automotive: 1.25,
  construction: 1.1,
  boats: 1.35,
  electronics: 1.05,
  campingvogn: 1.3,
  machinery: 1.4,
  furniture: 1.1,
  other: 1.15,
};

const roundToNearest50 = (value: number) => Math.round(value / 50) * 50;

export const estimateCargoPriceRange = ({
  cargoType,
  distanceKm,
  weightKg,
}: {
  cargoType?: string | null;
  distanceKm?: number | string | null;
  weightKg?: number | string | null;
}): PriceRangeEstimate => {
  const parsedDistance = Number(distanceKm || 0);
  const parsedWeight = Number(weightKg || 0);
  const hasCargoType = Boolean(cargoType);
  const hasDistance = parsedDistance > 0;

  if (!hasCargoType || !hasDistance) {
    return {
      min: null,
      max: null,
      distanceKm: hasDistance ? Math.round(parsedDistance) : null,
    };
  }

  const cargoFactor = CARGO_PRICE_FACTORS[cargoType as string] ?? CARGO_PRICE_FACTORS.other;
  const baseRatePerKm = 8.5;
  const weightComponent = parsedWeight > 0 ? Math.min(parsedWeight * 0.14, 2200) : 0;

  const baseline = Math.max(700, parsedDistance * baseRatePerKm * cargoFactor + weightComponent);

  return {
    min: roundToNearest50(baseline * 0.85),
    max: roundToNearest50(baseline * 1.25),
    distanceKm: Math.round(parsedDistance),
  };
};
