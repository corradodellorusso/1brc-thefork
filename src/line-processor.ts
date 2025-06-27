export type StationData = {
  min: number;
  max: number;
  sum: number;
  count: number;
};

export type Aggregations = Record<string, StationData>;

export function processLine(line: string, aggregations: Aggregations): void {
  // Fast character checks
  // 44  = ','   // Comma
  // 45  = '-'   // Minus sign
  // 46  = '.'   // Decimal point
  // 48-57 = '0'-'9'  // Digits
  // 32  = space, 13 = CR, 10 = LF  // Whitespace
  // Skip empty lines without trim() - check length and first char
  const len = line.length;
  if (
    len === 0 ||
    (len === 1 && (line.charCodeAt(0) === 13 || line.charCodeAt(0) === 10))
  )
    return;

  // Find comma using manual search (faster than indexOf for short strings)
  let commaIndex = -1;
  for (let i = 0; i < len; i++) {
    if (line.charCodeAt(i) === 44) {
      // ASCII 44 = ','
      commaIndex = i;
      break;
    }
  }
  if (commaIndex === -1) return;

  // Extract station name without trim() - find actual bounds
  let stationStart = 0;
  let stationEnd = commaIndex;

  // Skip leading whitespace manually
  while (stationStart < stationEnd && line.charCodeAt(stationStart) <= 32) {
    stationStart++;
  }

  // Skip trailing whitespace manually
  while (stationEnd > stationStart && line.charCodeAt(stationEnd - 1) <= 32) {
    stationEnd--;
  }

  if (stationStart >= stationEnd) return;

  // Extract temperature string bounds
  let tempStart = commaIndex + 1;
  let tempEnd = len;

  // Skip leading whitespace
  while (tempStart < tempEnd && line.charCodeAt(tempStart) <= 32) {
    tempStart++;
  }

  // Skip trailing whitespace and newlines
  while (tempEnd > tempStart && line.charCodeAt(tempEnd - 1) <= 32) {
    tempEnd--;
  }

  if (tempStart >= tempEnd) return;

  // Parse temperature without creating substring
  const temperature = parseTemperatureFast(line, tempStart, tempEnd);
  if (temperature === null) return;

  // Use substring only once for station name (unavoidable for hash key)
  const stationName = line.substring(stationStart, stationEnd);

  const existing = aggregations[stationName];

  if (existing) {
    existing.min = Math.min(existing.min, temperature);
    existing.max = Math.max(existing.max, temperature);
    existing.sum += temperature;
    existing.count++;
  } else {
    aggregations[stationName] = {
      min: temperature,
      max: temperature,
      sum: temperature,
      count: 1,
    };
  }
}

// Fast temperature parser that works directly on string without substring
function parseTemperatureFast(
  line: string,
  start: number,
  end: number,
): number | null {
  let result = 0;
  let sign = 1;
  let i = start;
  let hasDecimal = false;
  let decimalValue = 0;

  // Handle negative sign
  if (i < end && line.charCodeAt(i) === 45) {
    // ASCII 45 = '-'
    sign = -1;
    i++;
  }

  // Parse integer part
  while (i < end) {
    const charCode = line.charCodeAt(i);

    if (charCode === 46) {
      // ASCII 46 = '.'
      hasDecimal = true;
      i++;
      break;
    }

    if (charCode >= 48 && charCode <= 57) {
      // ASCII 48-57 = '0'-'9'
      result = result * 10 + (charCode - 48);
    } else {
      return null; // Invalid character
    }
    i++;
  }

  // Parse decimal part (only one digit expected)
  if (hasDecimal && i < end) {
    const charCode = line.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) {
      decimalValue = charCode - 48;
    } else {
      return null; // Invalid character
    }
  }

  // Convert to integer representation (multiply by 10)
  return sign * (result * 10 + decimalValue);
}

export function mergeAggregations(
  target: Aggregations,
  source: Aggregations,
): void {
  for (const [station, data] of Object.entries(source)) {
    const existing = target[station];
    if (existing) {
      existing.min = Math.min(existing.min, data.min);
      existing.max = Math.max(existing.max, data.max);
      existing.sum += data.sum;
      existing.count += data.count;
    } else {
      target[station] = {
        min: data.min,
        max: data.max,
        sum: data.sum,
        count: data.count,
      };
    }
  }
}
