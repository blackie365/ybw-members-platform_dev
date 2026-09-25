import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: false });
import GhostAdminAPI from "@tryghost/admin-api";

function nbu(raw: any): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  const wp = v.startsWith("http") ? v : `https://${v}`;
  return wp.replace(/\/$/, "");
}

(async () => {
  const key = process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY || "";
  const url = nbu(
    process.env.NEXT_PUBLIC_GHOST_URL ||
      process.env.GHOST_URL ||
      process.env.GHOST_ADMIN_URL ||
      process.env.GHOST_ADMIN_API_URL ||
      process.env.GHOST_API_URL ||
      process.env.NEXT_PUBLIC_SITE_URL,
  );
  const admin = new GhostAdminAPI({ url, key, version: "v5" });
  const firstPage: any = await admin.members.browse({
    limit: 5,
    include: "tiers,subscriptions,newsletters,labels",
  });
  const arr = Array.isArray(firstPage) ? firstPage : firstPage.members || [];
  for (const m of arr.slice(0, 3)) {
    console.log("=== email=", m.email, "name=", m.name, "status=", m.status, "comped=", m.comped, "paid=", (m as any)?.paid);
    console.log("  created_at=", m.created_at, "  last_seen_at=", m.last_seen_at);
    console.log("  stripe=", JSON.stringify(m?.stripe ?? null).slice(0, 200));
    console.log("  subscriptions (n=", (m.subscriptions || []).length, "):", JSON.stringify((m.subscriptions || []).slice(0, 1)).slice(0, 300));
    console.log("  tiers (n=", (m.tiers || []).length, "):", JSON.stringify(m.tiers || []).slice(0, 320));
    console.log("  newsletters (n=", (m.newsletters || []).length, "):", JSON.stringify(m.newsletters || []).slice(0, 300));
    console.log("  labels (n=", (m.labels || []).length, "):", JSON.stringify(m.labels || []).slice(0, 300));
    console.log(
      "  extras: email_count=",
      m.email_count,
      " email_opened_count=",
      m.email_opened_count,
      " email_open_rate=",
      m.email_open_rate,
      " geolocation=",
      m.geolocation,
      " note=",
      JSON.stringify(m.note ?? null).slice(0, 100),
    );
  }
  const all: any[] = [];
  let page = 1;
  while (true) {
    const res: any = await admin.members.browse({
      limit: 100,
      page,
      order: "created_at ASC",
      include: "tiers,subscriptions,newsletters,labels",
    });
    const arr2 = Array.isArray(res) ? res : res.members || [];
    if (!arr2.length) break;
    all.push(...arr2);
    const meta = res?.meta?.pagination;
    if (!meta || !meta.pages || page >= Number(meta.pages)) break;
    page++;
  }
  console.log("\n=== Ghost full (", all.length, ") richness counters ===");
  const c: Record<string, number> = {
    stripeCustomer: 0,
    subActive: 0,
    subAny: 0,
    paidTrue: 0,
    compedTrue: 0,
    statusPaid: 0,
    statusComped: 0,
    statusFree: 0,
    hasTiers: 0,
    multiTiers: 0,
    hasNewsletters: 0,
    hasLabels: 0,
    hasNote: 0,
    hasGeolocation: 0,
    hasEmailCount: 0,
  };
  for (const m of all) {
    if (m.stripe?.customer_id) c.stripeCustomer++;
    if ((m.subscriptions || []).length) c.subAny++;
    if ((m.subscriptions || []).filter((s: any) => s.status === "active").length) c.subActive++;
    if (m.paid === true) c.paidTrue++;
    if (m.comped === true) c.compedTrue++;
    if (m.status === "paid") c.statusPaid++;
    if (m.status === "comped") c.statusComped++;
    if (m.status === "free") c.statusFree++;
    if ((m.tiers || []).length) c.hasTiers++;
    if ((m.tiers || []).length > 1) c.multiTiers++;
    if ((m.newsletters || []).length) c.hasNewsletters++;
    if ((m.labels || []).length) c.hasLabels++;
    if (m.note) c.hasNote++;
    if (m.geolocation) c.hasGeolocation++;
    if (typeof m.email_count === "number") c.hasEmailCount++;
  }
  for (const [k, v] of Object.entries(c)) console.log("  " + k.padEnd(20) + " = " + v);
  console.log("DONE");
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
