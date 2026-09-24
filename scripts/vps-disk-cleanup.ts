import { mkdir, readdir, stat, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const APPDIR = process.env.APPDIR || "/srv/ybw-frontend";

(async () => {
  console.log(`=== VPS disk cleanup run APPDIR=${APPDIR} ===`);
  console.log("BEFORE:\n" + execSync("df -h /srv", { encoding: "utf8" }));

  const backups = join(APPDIR, "backups", "scripts-migrated-20260924");
  await mkdir(backups, { recursive: true });

  const scriptsDir = join(APPDIR, "scripts");
  const files = await readdir(scriptsDir);
  let movedMb = 0;
  for (const f of files) {
    if (!/^backup_\d+\.json$/.test(f)) continue;
    const src = join(scriptsDir, f);
    const dst = join(backups, f);
    const s = await stat(src);
    movedMb += s.size;
    await rename(src, dst);
    console.log(`mv scripts/${f} -> backups/scripts-migrated-20260924/${f} (${(s.size/1024).toFixed(0)}KB)`);
  }

  let rmKb = 0;
  const top = await readdir(APPDIR, { withFileTypes: true });
  for (const d of top) {
    if (!d.isFile() || !/^\.deploy-.*\.log$/.test(d.name)) continue;
    const p = join(APPDIR, d.name);
    const s = await stat(p);
    rmKb += s.size;
    await rm(p, { force: true });
    console.log(`rm ${d.name} (${s.size}B)`);
  }

  console.log(`\nTOTAL moved backup JSONs: ${(movedMb/1024/1024).toFixed(2)} MB into ${backups}`);
  console.log(`TOTAL removed stale deploy logs: ${(rmKb/1024).toFixed(1)} KB`);
  console.log("AFTER:\n" + execSync("df -h /srv", { encoding: "utf8" }));
  console.log("DONE");
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
