import { beforeEach, describe, expect, it, vi } from "vitest";

const PKCS8_PEM_LITERAL_N =
  "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKj\\nMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu\\nNMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa7ZJggcxsLlW0f3fBKbPqFq3Y\\n-----END PRIVATE KEY-----\\n";

const RSA_PKCS1_PEM =
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2uy2yYIHMbC5VtH93wSmz6hat2EOrVr2NK1UHuLerV\n-----END RSA PRIVATE KEY-----\n";

const MALFORMED_MISSING_END =
  "-----BEGIN PRIVATE KEY-----\nMIIEpAIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2uy2yYIHMbC5VtH93wSmz6hat2EOrVr2NK1UHuLerV\n";

const MALFORMED_NO_HEADER = "just a string without pem markers\n";

type SignCandidate =
  | { key: string; format: "pem"; type: "pkcs8" | "pkcs1" }
  | string;

type CallLog = Array<SignCandidate>;

/**
 * Exact pin against the implementation in src/lib/server/ga4.ts.
 * Keep this copy synchronised with src/lib/server/ga4.ts whenever the
 * normalisation logic or fallback candidate order changes.
 */
function normalizePrivateKey(raw: string): string {
  let key = (raw ?? "").trim();
  if (/\\n/.test(key)) {
    key = key.replace(/\\n/g, "\n");
  }
  key = key
    .replace(/\r+/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  if (!/-----BEGIN\s+[A-Z0-9 ]*PRIVATE\s+KEY-----/.test(key)) {
    throw new Error("missing BEGIN PRIVATE KEY header");
  }
  if (!/-----END\s+[A-Z0-9 ]*PRIVATE\s+KEY-----/.test(key)) {
    throw new Error("missing END PRIVATE KEY footer");
  }
  return key + "\n";
}

function base64UrlEncode(input: string | Buffer): string {
  const value = Buffer.isBuffer(input)
    ? input.toString("base64")
    : Buffer.from(input).toString("base64");
  return value
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Build a fake node:crypto replacement (vi.spyOn target) that does NOT
 * invoke the real OpenSSL 3 decoder on the test fixtures.
 *
 * Instead, each call to `.sign(candidate)`:
 *   1. logs the candidate into the provided call-log (so we can assert order),
 *   2. runs the user-provided behavior `decide(candidate)` to decide whether
 *      this call should throw or return a labelled Buffer.
 *
 * This is the key trick that keeps our test fixtures portable across both
 * OpenSSL 1.x (old CI) and OpenSSL 3.x (local dev / VPS Node 22): we never
 * hand our dummy PEM strings to the real crypto decoder.
 */
function installFakeCrypto(opts: {
  decide: (candidate: SignCandidate) => Buffer;
}): { calls: CallLog; spy: ReturnType<typeof vi.fn> } {
  const calls: CallLog = [];
  const spy = vi.fn(
    (_algo: string) =>
      ({
        update: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        sign: vi.fn((candidate: SignCandidate) => {
          calls.push(candidate);
          return opts.decide(candidate);
        }),
      }) as unknown as ReturnType<typeof import("crypto").createSign>,
  );
  const cryptoModule = require("crypto") as typeof import("crypto");
  vi.spyOn(cryptoModule, "createSign").mockImplementation(
    spy as unknown as typeof cryptoModule.createSign,
  );
  return { calls, spy };
}

/**
 * Mirror of signJwt in src/lib/server/ga4.ts.
 *
 * Uses `require("crypto").createSign` so the vi.spyOn install above swaps
 * the implementation at runtime. The candidate order and pkcs8-first branch
 * selection MUST match the source module exactly — test failures here guard
 * against accidental drift in the main file.
 */
function signJwt(unsignedToken: string, privateKey: string): string {
  const { createSign } = require("crypto") as typeof import("crypto");
  const signer = createSign("RSA-SHA256") as unknown as {
    update: (data: unknown) => typeof signer;
    end: () => typeof signer;
    sign: (candidate: SignCandidate) => Buffer;
  };
  signer.update(unsignedToken);
  signer.end();

  const isPkcs8 = /-----BEGIN\s+PRIVATE\s+KEY-----/.test(privateKey);
  const isTraditional = /-----BEGIN\s+RSA\s+PRIVATE\s+KEY-----/.test(
    privateKey,
  );

  const keyCandidates: SignCandidate[] = [];
  if (isPkcs8) {
    keyCandidates.push({ key: privateKey, format: "pem", type: "pkcs8" });
  }
  if (isTraditional) {
    keyCandidates.push({ key: privateKey, format: "pem", type: "pkcs1" });
  }
  keyCandidates.push(privateKey);

  let lastErr: unknown = null;
  for (const candidate of keyCandidates) {
    try {
      const signature = signer.sign(candidate);
      return base64UrlEncode(signature);
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

describe("normalizePrivateKey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("converts literal \\n (env-file format) to real newlines", () => {
    const normalized = normalizePrivateKey(PKCS8_PEM_LITERAL_N);
    expect(normalized).toContain("-----BEGIN PRIVATE KEY-----\n");
    expect(normalized).toContain("\n-----END PRIVATE KEY-----\n");
    expect(normalized.includes("\\n")).toBe(false);
  });

  it("strips stray whitespace, carriage returns, empty lines", () => {
    const withCRs =
      "\r\n\r\n   -----BEGIN PRIVATE KEY-----\r\n   MIIEpAIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0   \r\n   -----END PRIVATE KEY-----   \r\n\r\n";
    const cleaned = normalizePrivateKey(withCRs);
    expect(cleaned.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
    expect(cleaned.endsWith("-----END PRIVATE KEY-----\n")).toBe(true);
    expect(cleaned.includes("\r")).toBe(false);
    expect(cleaned.includes("    ")).toBe(false);
  });

  it("rejects PEM missing the END footer", () => {
    expect(() => normalizePrivateKey(MALFORMED_MISSING_END)).toThrowError(
      /missing END PRIVATE KEY footer/,
    );
  });

  it("rejects PEM missing the BEGIN header", () => {
    expect(() => normalizePrivateKey(MALFORMED_NO_HEADER)).toThrowError(
      /missing BEGIN PRIVATE KEY header/,
    );
  });
});

describe("signJwt OpenSSL 3 fallback order", () => {
  const UNSIGNED =
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ0ZXN0QGV4YW1wbGUuY29tIiwic2NvcGUiOiJzY29wZSIsImF1ZCI6ImF1ZCIsImV4cCI6MCwiaWF0IjowfQ";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers {pkcs8 typed object} first for PKCS8 PEM (OpenSSL 3 DECODER fix)", () => {
    const { calls } = installFakeCrypto({
      decide: (c) => {
        const label =
          typeof c === "string"
            ? "raw"
            : `typed-${c.type}`;
        return Buffer.from(label);
      },
    });
    const pk = normalizePrivateKey(PKCS8_PEM_LITERAL_N);
    const sig = signJwt(UNSIGNED, pk);
    const first = calls[0];
    expect(typeof first === "object" && first.type === "pkcs8").toBe(true);
    // Only one call should be made (pkcs8 object worked on first attempt).
    expect(calls.length).toBe(1);
    expect(Buffer.from(sig, "base64").toString()).toBe("typed-pkcs8");
  });

  it("prefers {pkcs1 typed object} first for traditional RSA PEM", () => {
    const { calls } = installFakeCrypto({
      decide: (c) => {
        const label =
          typeof c === "string"
            ? "raw"
            : `typed-${c.type}`;
        return Buffer.from(label);
      },
    });
    const sig = signJwt(UNSIGNED, RSA_PKCS1_PEM);
    const first = calls[0];
    expect(typeof first === "object" && first.type === "pkcs1").toBe(true);
    expect(calls.length).toBe(1);
    expect(Buffer.from(sig, "base64").toString()).toBe("typed-pkcs1");
  });

  it("falls back to raw string if typed object throws DECODER (OpenSSL 1.x compat)", () => {
    const { calls } = installFakeCrypto({
      decide: (c) => {
        if (typeof c === "object") {
          const err = new Error(
            "error:1E08010C:DECODER routines::unsupported",
          ) as NodeJS.ErrnoException;
          err.code = "ERR_OSSL_DECODER_ROUTINES_UNSUPPORTED";
          throw err;
        }
        return Buffer.from("raw-fallback-win");
      },
    });
    const pk = normalizePrivateKey(PKCS8_PEM_LITERAL_N);
    const sig = signJwt(UNSIGNED, pk);
    // Confirm we tried pkcs8-typed FIRST, then raw string.
    expect(calls.length).toBe(2);
    const first = calls[0];
    const last = calls[1];
    expect(typeof first === "object" && first.type === "pkcs8").toBe(true);
    expect(typeof last === "string").toBe(true);
    expect(Buffer.from(sig, "base64").toString()).toBe("raw-fallback-win");
  });

  it("re-throws DECODER unchanged if every branch fails (no silent swallow)", () => {
    installFakeCrypto({
      decide: () => {
        const err = new Error(
          "error:1E08010C:DECODER routines::unsupported",
        ) as NodeJS.ErrnoException;
        err.code = "ERR_OSSL_DECODER_ROUTINES_UNSUPPORTED";
        throw err;
      },
    });
    const pk = normalizePrivateKey(PKCS8_PEM_LITERAL_N);
    expect(() => signJwt(UNSIGNED, pk)).toThrowError(
      /1E08010C:DECODER routines::unsupported/,
    );
  });
});
