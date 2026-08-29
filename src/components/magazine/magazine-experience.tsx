import { getMagazineReadStore } from '@/features/magazine/server/read-store';
import { MagazineExperienceClient } from "./MagazineExperienceClient";

export async function MagazineExperience() {
  const editions = await getMagazineReadStore().listReaderEditions(1).catch(() => []);
  const latestIssue = editions[0] ?? null;

  if (!latestIssue) return null;

  return <MagazineExperienceClient latestIssue={latestIssue} />;
}
