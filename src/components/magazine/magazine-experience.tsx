import { listEditions } from '@/features/magazine/server/edition-repository';
import { MagazineExperienceClient } from "./MagazineExperienceClient";

export async function MagazineExperience() {
  // Use the V2 edition system — find the live edition or fall back to the most recent
  const editions = await listEditions(1).catch(() => []);
  const latestIssue = editions[0] ?? null;

  if (!latestIssue) return null;

  return <MagazineExperienceClient latestIssue={latestIssue} />;
}
