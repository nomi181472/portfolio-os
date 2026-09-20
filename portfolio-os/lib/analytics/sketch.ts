/**
 * lib/analytics/sketch.ts
 *
 * A small HyperLogLog used to count unique visitors per deployment/day/hour
 * without ever storing the visitor IDs themselves (§6). Memory is fixed: p=12
 * yields 4096 registers (~4 KB) regardless of how many visitors pass through.
 *
 * Approximate by design. For the traffic a portfolio sees the error is a few
 * percent, which is more than enough for "unique visitors this deployment".
 */
import { createHash } from 'node:crypto';

const P = 12;
const M = 1 << P; // 4096 registers
const MASK = M - 1;
const ALPHA = 0.7213 / (1 + 1.079 / M);

const countLeadingZeros64 = (high: number, low: number): number => {
  if (high !== 0) return Math.clz32(high);
  return 32 + Math.clz32(low);
};

export class Hll {
  private registers: Uint8Array;

  constructor(registers: Uint8Array = new Uint8Array(M)) {
    this.registers = registers;
  }

  /** Add a string (visitor id) to the sketch. Idempotent per distinct value. */
  add(value: string): void {
    // Collision-resistant 64-bit keyed digest; deterministic, no personal data.
    const buf = createHash('sha256').update('hll:' + value).digest();
    const high = buf.readUInt32BE(0);
    const low = buf.readUInt32BE(4);
    const index = (high >>> (32 - P)) & MASK; // use only top bits for index
    const rank = countLeadingZeros64((high << P) | (low >>> (32 - P)), low << P) + 1;
    if (rank > this.registers[index]!) this.registers[index] = rank;
  }

  mergeInto(target: Hll): void {
    for (let i = 0; i < M; i += 1) {
      if (this.registers[i]! > target.registers[i]!) target.registers[i] = this.registers[i]!;
    }
  }

  /** Cardinality estimate (bias-corrected for the small ranges a portfolio hits). */
  estimate(): number {
    let sum = 0;
    let zeros = 0;
    for (let i = 0; i < M; i += 1) {
      const reg = this.registers[i]!;
      sum += 1 / 2 ** reg;
      if (reg === 0) zeros += 1;
    }
    const raw = (ALPHA * M * M) / sum;
    // Linear counting for small cardinalities (raw <= 2.5m and zeros remain).
    if (raw <= 2.5 * M && zeros > 0) {
      return Math.round(M * Math.log(M / zeros));
    }
    return Math.round(raw);
  }

  get registerBytes(): number {
    return M;
  }

  toJSON(): Uint8Array {
    return this.registers;
  }

  static fromJSON(data: Uint8Array): Hll {
    return new Hll(Uint8Array.from(data));
  }
}

/** Combines sketches whose internal hash streams are independent. */
export function mergeHlls(sketches: Hll[]): Hll {
  const merged = new Hll();
  for (const sketch of sketches) sketch.mergeInto(merged);
  return merged;
}