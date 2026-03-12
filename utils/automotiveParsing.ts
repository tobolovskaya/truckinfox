export type AutomotiveCondition = {
  isDriveable: boolean | null;
  starts: boolean | null;
  hasDamage: boolean | null;
};

export type AutomotiveMeta = {
  driveable?: unknown;
  starts?: unknown;
  damage?: unknown;
  vin?: unknown;
  has_keys?: unknown;
  wheel_lock?: unknown;
  ground_clearance_cm?: unknown;
  needs_winch?: unknown;
  transport_type?: unknown;
} | null;

export type AutomotiveMetaDetails = {
  vin?: string;
  hasKeys?: boolean;
  hasWheelLock?: boolean;
  groundClearanceCm?: number;
  needsWinch?: boolean;
  transportType?: 'open' | 'enclosed';
};

export const parseBooleanToken = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (['yes', 'ja', 'true', '1'].includes(normalized)) return true;
  if (['no', 'nei', 'false', '0'].includes(normalized)) return false;
  return null;
};

export const parseAutomotiveMeta = (value: AutomotiveMeta): AutomotiveCondition | null => {
  if (!value || typeof value !== 'object') return null;

  const readBoolean = (input: unknown): boolean | null => {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') return parseBooleanToken(input);
    if (typeof input === 'number') {
      if (input === 1) return true;
      if (input === 0) return false;
    }
    return null;
  };

  const meta = value as { driveable?: unknown; starts?: unknown; damage?: unknown };
  const parsed: AutomotiveCondition = {
    isDriveable: readBoolean(meta.driveable),
    starts: readBoolean(meta.starts),
    hasDamage: readBoolean(meta.damage),
  };

  const hasAnyCondition =
    parsed.isDriveable !== null || parsed.starts !== null || parsed.hasDamage !== null;

  return hasAnyCondition ? parsed : null;
};

export const parseAutomotiveMetaDetails = (value: AutomotiveMeta): AutomotiveMetaDetails | null => {
  if (!value || typeof value !== 'object') return null;

  const meta = value as {
    vin?: unknown;
    has_keys?: unknown;
    wheel_lock?: unknown;
    ground_clearance_cm?: unknown;
    needs_winch?: unknown;
    transport_type?: unknown;
  };

  const readBoolean = (input: unknown): boolean | undefined => {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      const p = parseBooleanToken(input);
      return p === null ? undefined : p;
    }
    if (typeof input === 'number') {
      if (input === 1) return true;
      if (input === 0) return false;
    }
    return undefined;
  };

  const clearanceRaw = meta.ground_clearance_cm;
  const clearance =
    typeof clearanceRaw === 'number'
      ? clearanceRaw
      : typeof clearanceRaw === 'string'
        ? Number(clearanceRaw)
        : NaN;

  const parsed: AutomotiveMetaDetails = {
    vin: typeof meta.vin === 'string' && meta.vin.trim().length > 0 ? meta.vin.trim() : undefined,
    hasKeys: readBoolean(meta.has_keys),
    hasWheelLock: readBoolean(meta.wheel_lock),
    groundClearanceCm: Number.isFinite(clearance) ? clearance : undefined,
    needsWinch: readBoolean(meta.needs_winch),
    transportType:
      meta.transport_type === 'enclosed'
        ? 'enclosed'
        : meta.transport_type === 'open'
          ? 'open'
          : undefined,
  };

  const hasAnyValue = Object.values(parsed).some(v => v !== undefined);
  return hasAnyValue ? parsed : null;
};

export const parseAutomotiveDescription = (
  description: string | null | undefined
): { cleanDescription: string; condition: AutomotiveCondition | null } => {
  if (!description) {
    return { cleanDescription: '', condition: null };
  }

  let cleaned = description;
  const condition: AutomotiveCondition = {
    isDriveable: null,
    starts: null,
    hasDamage: null,
  };

  const machineTagMatch = cleaned.match(/^\[automotive_condition\|([^\]]+)\]\s*/i);
  if (machineTagMatch) {
    const pairs = machineTagMatch[1].split('|');
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      const key = (rawKey || '').trim().toLowerCase();
      const value = parseBooleanToken(rawValue || '');

      if (key === 'driveable') condition.isDriveable = value;
      else if (key === 'starts') condition.starts = value;
      else if (key === 'damage') condition.hasDamage = value;
    }
    cleaned = cleaned.slice(machineTagMatch[0].length);
  }

  const humanTagMatch = cleaned.match(/^\[([\s\S]*?)\]\s*/);
  if (humanTagMatch) {
    const block = humanTagMatch[1];
    const lowerBlock = block.toLowerCase();
    const likelyAutomotiveBlock =
      /driveable|non.?driveable|kjørbar|kan rulles|vinsj|starter|starts|skader|damage/.test(lowerBlock);

    if (likelyAutomotiveBlock) {
      const lines = block
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const [rawLabel, rawValue] = line.includes(':')
          ? line.split(/:(.+)/).slice(0, 2)
          : [line, ''];
        const label = (rawLabel || '').toLowerCase();
        const value = parseBooleanToken(rawValue || '');

        if (
          condition.isDriveable === null &&
          /(driveable|kjørbar|rulles|non.?driveable|vinsj)/.test(label)
        ) {
          if (value !== null) {
            condition.isDriveable = value;
          } else if (/ikke|non|vinsj/.test(label)) {
            condition.isDriveable = false;
          } else if (/kjørbar|rulles|driveable/.test(label)) {
            condition.isDriveable = true;
          }
        }

        if (condition.starts === null && /(starts|starter)/.test(label) && value !== null) {
          condition.starts = value;
        }

        if (condition.hasDamage === null && /(damage|skader)/.test(label) && value !== null) {
          condition.hasDamage = value;
        }
      }

      cleaned = cleaned.slice(humanTagMatch[0].length);
    }
  }

  const hasAnyCondition =
    condition.isDriveable !== null || condition.starts !== null || condition.hasDamage !== null;

  return {
    cleanDescription: cleaned.trim(),
    condition: hasAnyCondition ? condition : null,
  };
};

export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
