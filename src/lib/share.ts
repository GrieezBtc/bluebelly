import { randomInt } from "node:crypto";

// No 0/O/1/l/I so codes are easy to read and retype. 57^6 ≈ 34 billion combinations.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
export const SHARE_CODE_LENGTH = 6;

export function generateShareCode() {
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function isValidShareCode(code: string) {
  return /^[A-Za-z0-9]{4,12}$/.test(code);
}
