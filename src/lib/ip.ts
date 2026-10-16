/** Minimal IPv4/IPv6 CIDR matching for the "allowed IP ranges" setting. */

function parseV4(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = BigInt(0);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = (n << BigInt(8)) + BigInt(Number(p));
  }
  return n;
}

function parseV6(ip: string): bigint | null {
  let addr = ip.toLowerCase();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);
  // IPv4-mapped tail, eg ::ffff:10.0.0.1
  const v4tail = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const v4 = parseV4(v4tail[1]);
    if (v4 === null) return null;
    addr = addr.slice(0, -v4tail[1].length) + ((v4 >> BigInt(16)) & BigInt(0xffff)).toString(16) + ":" + (v4 & BigInt(0xffff)).toString(16);
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  let n = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << BigInt(16)) + BigInt(parseInt(g, 16));
  }
  return n;
}

function parse(ip: string): { v: 4 | 6; n: bigint } | null {
  const v4 = parseV4(ip);
  if (v4 !== null) return { v: 4, n: v4 };
  const v6 = parseV6(ip);
  if (v6 === null) return null;
  // treat IPv4-mapped IPv6 as IPv4
  if (v6 >> BigInt(32) === BigInt(0xffff)) return { v: 4, n: v6 & BigInt(0xffffffff) };
  return { v: 6, n: v6 };
}

export function isValidRange(range: string) {
  const [base, bits] = range.trim().split("/");
  const p = parse(base);
  if (!p) return false;
  if (bits === undefined) return true;
  const b = Number(bits);
  return Number.isInteger(b) && b >= 0 && b <= (p.v === 4 ? 32 : 128);
}

export function ipInRange(ip: string, range: string) {
  const a = parse(ip.trim());
  const [base, bits] = range.trim().split("/");
  const r = parse(base);
  if (!a || !r || a.v !== r.v) return false;
  const width = a.v === 4 ? 32 : 128;
  const prefix = bits === undefined ? width : Number(bits);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > width) return false;
  const shift = BigInt(width - prefix);
  return a.n >> shift === r.n >> shift;
}

export function ipAllowed(ip: string | null | undefined, ranges: string[] | null | undefined) {
  if (!ranges?.length) return true;
  if (!ip) return true; // no address known (scripts, cron): nothing to check
  return ranges.some((r) => ipInRange(ip, r));
}
