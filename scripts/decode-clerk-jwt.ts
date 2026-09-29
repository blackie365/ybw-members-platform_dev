#!/usr/bin/env npx tsx
import * as fs from "fs";

function base64urlDecode(s: string) {
  const pad = 4 - (s.length % 4);
  const padded = s + (pad !== 4 ? "=".repeat(pad) : "");
  const buff = Buffer.from(padded, "base64url");
  try {
    return JSON.parse(buff.toString("utf8"));
  } catch {
    return { raw: buff.toString("utf8") };
  }
}

function decodeImgClerkJwt(url: string) {
  // format: https://img.clerk.com/<JWT>
  if (!url || !url.includes("img.clerk.com/")) return null;
  const token = url.split("img.clerk.com/")[1].split("?")[0];
  const [, payload] = token.split(".");
  if (!payload) return null;
  return base64urlDecode(payload);
}

const sample = fs
  .readFileSync("/tmp/clerk-recoverable-photos.csv", "utf8")
  .split("\n")
  .slice(1, 6)
  .map(l => l.split(",").pop()?.slice(1, -2) || "")
  .filter(Boolean);

console.log("=== Decoding sample img.clerk.com JWT payloads ===");
for (const url of sample) {
  const p = decodeImgClerkJwt(url);
  console.log(url.substring(0, 70) + "...");
  console.log(JSON.stringify(p, null, 2));
}
