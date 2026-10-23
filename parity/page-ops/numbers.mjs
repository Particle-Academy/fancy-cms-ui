import { Buffer } from "node:buffer";
import { SEED } from "./generate.mjs";

/** Every finite power of two plus seeded IEEE-754 bit patterns. Own code. */
export function generateNumbers() {
  const values = [0, 0.1, 2.9, 1e20, 1e21, 1e-6, 1e-7, 1000000000000000100];
  for (let exponent = -1074; exponent <= 1023; exponent++) values.push(2 ** exponent, -(2 ** exponent));
  let state = SEED;
  const next = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return state >>> 0;
  };
  const bytes = Buffer.alloc(8);
  for (let i = 0; i < 10000; i++) {
    bytes.writeUInt32LE(next(), 0); bytes.writeUInt32LE(next(), 4);
    const value = bytes.readDoubleLE();
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}
