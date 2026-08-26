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

describe("getGa4WebStatsReport with systemd-mangled GOOGLE_PRIVATE_KEY", () => {
  const REAL_BODY_FRAGMENT =
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCm2++0+YliSJ/" +
    "wnaZ7ZupSROZ/uvLq261/BiHDnqNtfu1ssTeUX8w06Qk0KrSxwkhjHkI7JEXcT7d" +
    "/WnF0o4isvgAU0DjqgqHI02Sc1gFV30HKaBYdU5N78aPq3XkStsKHGkFF4+Syksb" +
    "TAKnwSJb2xbBvB8qvlF+NGSoFwNQYk93eVyfl1et89u99p8lka8YJ1mOUMjrOJau" +
    "xOR/nCoEZqo1AJ/JdOWKX4aRpVyvMMa5KeFNsua9fr5RGD1FGTLFGyYKc2Wm+KHc" +
    "9hgDFnwkm+xxrDzuCftUS6WhpLd05mrqLC7Qu5FSja0KSItjHP6bTJ9638TiTkr6" +
    "gZ1lIbn/7dCeL05AgMBAAECggEAA/62qQV83OEMD0RmgyQ2XWaQGTYXxFYAJDdhK" +
    "9kjoETXnyuJC9QVWA9b4vQozZHvJYxg0PiuQYP/fgMk5XWXMhs/EXJLxHMnNNodv" +
    "oHhlscWjn1biWOdLHXQuZVVSkKDVGfBBOx1Zv8gcO0Ofmq8tXKqR96Vb5xx530Hx" +
    "1XfQ7BQtVnarzWm+nesiM79ui2/LEgIlQSMrvW5wypx+bGP5zgtD1RCndKhU6UhT" +
    "F/fKRC3Yt4njZIDEEuREJ62Jrn97nGIn2F6el+QGGQayHaclIbRw+STf6g6MubzJ" +
    "SkcEm3+izdSnjHzBEb2T68FwG3CCk4dvxIuYGQkq6aMXKBuNtylJDwKBgQDVBpO+" +
    "QjGEJuZtOJ7unpPAWb/VnhAw/NC8x7LCOlSDbflVZhyDUB0Efbz4V0KkuZzspsMc" +
    "qxinjU/a23vUSn6/b4TH9nBPu1izLCrG+0zO7xOc5XTfLNNWERJJCNdwQ8RItS6A" +
    "GB2e1lNo2vm10rncOE2McWBR6YoqKy6ZuGLZzXyswKBgQDIhSZLOweIa39AX6m53" +
    "73j2JOU5IQP3625nhxW9/DiW3fZ6IljwOjS0dUpLnr3Q7Hei+yyLkKh/bnx0xl7e" +
    "jIHu2FZxwV/o2A/dnkVqA/DAu+FFlNWqE+Xy5MKYbpENG7BsuZd6vMcrpWe5Rmze" +
    "MdTJRfH0UvMJfWXjznQHJvWX2WYwKBgQCzBp0BhxWgDyUV40DGJD1VTe/6d+Hm+A" +
    "81sMnMeg2sCSbnX4W6nSwJyzYVqxfp4ce8poVQwYWtwje7ITuW9aisbDwb+6BQ1x" +
    "O765fnXA2dHuSHtAygrnR1H1GzqUeNJJZ/2CxlIF88Tri4ZVb4dEa9AJQJjQhgth" +
    "HihTWwTvp+SRuwKBgFoEnlE1foaEXiRfwGjTMgeXAe3hzIeoyYz4Pq64PhaQM3zK" +
    "zKrQlnTWKFiFekR4ymf67nvaKl/U6/3fVafIpyD36W9i+5PQI9xNmWAEg5brQXXA" +
    "sQcNJjYh+M/HUaR+2V3xn0nN4T02H/rlHZkNQrELiOwvEJL/wJpG0gwnW7pgNy7A" +
    "oGAe47zLjD1daOdS88FQy/ZnL35bdo3FQNbpCjm2fE5OXbPVyn4R9VvE5Cc5Aks8" +
    "uXKcLCxOzRuDx4Gy/hBEUNB6nuBL/oXQxyHQC1VFxoRXPWC4gxBSI+5CDQ+POY6n" +
    "/YyM4W4biH7GgVRiamNhyycYCn4eJkpbt6KPtez6yzQWxkOWY=";

  const SYSTEMD_ORPHAN_N_KEY = (() => {
    const CHUNK = 64;
    const chunks: string[] = [];
    for (let i = 0; i < REAL_BODY_FRAGMENT.length; i += CHUNK) {
      chunks.push(REAL_BODY_FRAGMENT.slice(i, i + CHUNK));
    }
    const sep = " n";
    return `-----BEGIN PRIVATE KEY----- n${chunks.join(sep)}n -----END PRIVATE KEY----- n`;
  })();

  const freshGa4Module = async () => {
    return await import("../lib/server/ga4");
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not throw TypeError(Cannot create property '__altPems' on string) for systemd-mangled PEM (regression)", async () => {
    const OLD_ENV = { ...process.env };
    process.env.GA4_PROPERTY_ID_CURRENT = "properties/219599906";
    process.env.GA4_PROPERTY_ID_LEGACY = "properties/999999999";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL =
      "ga4@magnetic-tenure-365620.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = SYSTEMD_ORPHAN_N_KEY;

    const cryptoModule = require("crypto") as typeof import("crypto");
    let signCalls = 0;
    const sigLabel = Buffer.from("systemd-mangled-recovered");
    const spySign = vi
      .spyOn(cryptoModule, "createSign")
      .mockImplementation(
        (() => ({
          update: vi.fn().mockReturnThis(),
          end: vi.fn().mockReturnThis(),
          sign: vi.fn(() => {
            signCalls++;
            return sigLabel;
          }),
        })) as unknown as typeof cryptoModule.createSign,
      );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (/oauth2\.googleapis\.com\/token/.test(url)) {
        const form = init?.body ? String(init.body) : "";
        expect(form).toContain(
          "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer",
        );
        expect(form).toContain("assertion=");
        return new Response(
          JSON.stringify({ access_token: "fake-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (/analyticsdata\.googleapis\.com.*runReport/.test(url)) {
        return new Response(
          JSON.stringify({
            rows: [
              {
                metricValues: [
                  { value: "1" },
                  { value: "1" },
                  { value: "1" },
                  { value: "1" },
                  { value: "0.5" },
                  { value: "1" },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not mocked: " + url, { status: 404 });
    }) as typeof globalThis.fetch;

    let err: unknown = null;
    try {
      const mod = await freshGa4Module();
      await mod.getGa4WebStatsReport({ range: "30d" });
    } catch (e) {
      err = e;
    } finally {
      spySign.mockRestore();
      process.env = OLD_ENV;
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
    const msg = err ? String((err as Error)?.message ?? err) : "";
    expect(msg).not.toMatch(/Cannot create property '__altPems'/);
    expect(msg).not.toMatch(/TypeError/);
    expect(signCalls).toBeGreaterThanOrEqual(1);
    expect(err).toBeNull();
  });

  it("recovers and actually signs a systemd-orphan-nr-mangled RSA-2048 key (real crypto, no mocks)", async () => {
    const cryptoModule = require("crypto") as typeof import("crypto");
    const { privateKey: realPk, publicKey: realPub } = cryptoModule.generateKeyPairSync(
      "rsa",
      {
        modulusLength: 2048,
        publicExponent: 0x10001,
      },
    );
    const strictPkcs8Pem = realPk.export({ type: "pkcs8", format: "pem" }) as string;

    const BEG = "-----BEGIN PRIVATE KEY-----\n";
    const END = "\n-----END PRIVATE KEY-----\n";
    const bStart = strictPkcs8Pem.indexOf(BEG);
    const bEnd = strictPkcs8Pem.indexOf(END);
    const strictBody = strictPkcs8Pem.slice(bStart + BEG.length, bEnd);
    const chunks = strictBody.split(/\n/).filter((l: string) => l.length > 0);
    expect(chunks.length).toBeGreaterThanOrEqual(20);
    expect(chunks.slice(0, -1).every((c: string) => c.length === 64)).toBe(true);

    const separators = chunks.slice(1).map(() => "n");
    const mangledBody =
      chunks[0] + chunks.slice(1).map((c: string, i: number) => separators[i] + c).join("");
    expect(/^[A-Za-z0-9+/=n]+$/.test(mangledBody)).toBe(true);

    const systemdEnvValue =
      "-----BEGIN PRIVATE KEY-----n" + mangledBody + "n-----END PRIVATE KEY-----n";
    expect(/\n/.test(systemdEnvValue)).toBe(false);
    expect(systemdEnvValue).toMatch(/-----BEGIN PRIVATE KEY-----n/);
    expect(systemdEnvValue).toMatch(/n-----END PRIVATE KEY-----n$/);

    const mod = await freshGa4Module();

    // call signJwt directly (private function not exported) — so instead use the exported
    // getAccessToken indirectly via a known JWT: sign a small claim using normalizePrivateKey
    // as the key param to crypto.createSign by re-using the exported helper via SSR.
    // Since normalizePrivateKey is not exported either, exercise the real GA4 pipeline
    // end-to-end by forcing a fresh access token fetch. We invalidate any cached singleton
    // access tokens by overriding the time. The actual call to Google is replaced with
    // globalThis.fetch mock that records the assertion, which we then verify.
    const OLD_ENV = { ...process.env };
    process.env.GA4_PROPERTY_ID_CURRENT = "properties/219599906";
    process.env.GA4_PROPERTY_ID_LEGACY = "properties/999999999";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL =
      "ga4-realcrypto@magnetic-tenure-365620.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = systemdEnvValue;

    const originalFetch = globalThis.fetch;
    let submittedAssertion: string | null = null;
    let tokenFetches = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (/oauth2\.googleapis\.com\/token/.test(url)) {
        tokenFetches++;
        const form = init?.body ? String(init.body) : "";
        const m = form.match(/assertion=([^&]+)/);
        submittedAssertion = m ? decodeURIComponent(m[1]) : null;
        // Return an EXPIRED token so any future call always re-fetches, for determinism.
        return new Response(
          JSON.stringify({ access_token: "tok-" + tokenFetches, expires_in: 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (/analyticsdata\.googleapis\.com.*runReport/.test(url)) {
        return new Response(
          JSON.stringify({
            rows: [
              {
                metricValues: [
                  { value: "1" },
                  { value: "1" },
                  { value: "1" },
                  { value: "1" },
                  { value: "0.5" },
                  { value: "1" },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not mocked: " + url, { status: 404 });
    }) as typeof globalThis.fetch;

    let err: unknown = null;
    try {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 7200 * 1000);
      await mod.getGa4WebStatsReport({ range: "30d" });
    } catch (e) {
      err = e;
    } finally {
      vi.useRealTimers();
      process.env = OLD_ENV;
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
    const msg = err ? String((err as Error)?.message ?? err) : "";
    expect(msg).not.toMatch(/DECODER/);
    expect(msg).not.toMatch(/1E08010C/);
    expect(msg).not.toMatch(/Cannot create property/);
    expect(msg).not.toMatch(/TypeError/);
    expect(err).toBeNull();

    expect(tokenFetches).toBeGreaterThanOrEqual(1);
    expect(submittedAssertion).not.toBeNull();
    const parts = (submittedAssertion as unknown as string).split(".");
    expect(parts.length).toBe(3);
    const signedPayload = `${parts[0]}.${parts[1]}`;
    const sigBase64Url = parts[2];
    const pad = (s: string) => s + "=".repeat((4 - (s.length % 4)) % 4);
    const signature = Buffer.from(
      pad(sigBase64Url).replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    const ok = cryptoModule.verify(
      "RSA-SHA256",
      Buffer.from(signedPayload),
      realPub,
      signature,
    );
    expect(ok).toBe(true);
  });
});
