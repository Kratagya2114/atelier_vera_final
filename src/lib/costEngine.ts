export interface CalculatePayload {
  styleCards: string[];
  spaceType: string;
  areaSqft: number;
  finishTier: 'tier1' | 'tier2' | 'tier3';
  currency: 'INR' | 'USD';
}

export function calculateArchitecturalQuote(payload: CalculatePayload) {
  const baseRatesInr = { tier1: 4800, tier2: 8200, tier3: 14500 };
  const spaceMultipliers: Record<string, number> = {
    'Full Residence': 1.0,
    'Single Room Transformation': 1.12,
    'Boutique Hospitality / Commercial': 1.18,
    'Modular Kitchen & Wardrobes': 0.85,
  };

  const rateInr = baseRatesInr[payload.finishTier] || 8200;
  const mult = spaceMultipliers[payload.spaceType] || 1.0;
  const baseTotalInr = payload.areaSqft * rateInr * mult;

  const totalMinInr = Math.round(baseTotalInr * 0.94);
  const totalMaxInr = Math.round(baseTotalInr * 1.08);
  const fx = payload.currency === 'USD' ? 1 / 84 : 1;

  const minVal = Math.round(totalMinInr * fx);
  const maxVal = Math.round(totalMaxInr * fx);

  const estimatedWeeksMin = Math.max(
    8,
    Math.round(10 + payload.areaSqft / 650 + (payload.finishTier === 'tier3' ? 4 : 0))
  );

  const referenceCode = `AV-2026-${Math.floor(1000 + Math.random() * 8999)}`;

  return {
    referenceCode,
    computedStylePersona: '65% Tactile Wabi-Sabi / 35% Warm Brutalist',
    currency: payload.currency,
    breakdown: {
      civil: { min: Math.round(minVal * 0.28), max: Math.round(maxVal * 0.28), pct: 28 },
      millwork: { min: Math.round(minVal * 0.26), max: Math.round(maxVal * 0.26), pct: 26 },
      lighting: { min: Math.round(minVal * 0.12), max: Math.round(maxVal * 0.12), pct: 12 },
      furniture: { min: Math.round(minVal * 0.22), max: Math.round(maxVal * 0.22), pct: 22 },
      design_fee: { min: Math.round(minVal * 0.12), max: Math.round(maxVal * 0.12), pct: 12 },
      total_min: minVal,
      total_max: maxVal,
      estimated_weeks: `${estimatedWeeksMin}–${estimatedWeeksMin + 4}`,
    },
    matchedPalette: [
      { name: 'Honed Roman Travertine', hex: '#D8CCB8', role: 'Primary Stone' },
      { name: 'Hand-Troweled Araish Lime', hex: '#EAE3D5', role: 'Mineral Envelope' },
      { name: 'Fluted Smoked Walnut', hex: '#4A372B', role: 'Acoustic Joinery' },
      { name: 'Unlacquered Bastar Bronze', hex: '#9A5B3E', role: 'Hardware & Light' },
      { name: 'Botanical Courtyard Moss', hex: '#2F3E35', role: 'Textiles & Courts' },
    ],
  };
}
