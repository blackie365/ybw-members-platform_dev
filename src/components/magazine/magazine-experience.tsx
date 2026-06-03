import { getLatestIssueServer } from "@/lib/magazine-service-server";
import { MagazineExperienceClient } from "./MagazineExperienceClient";

export async function MagazineExperience() {
  // Fetch latest issue on the server using Admin SDK (bypasses Firestore rules)
  const latestIssue = await getLatestIssueServer();

  if (!latestIssue) return null;

  return <MagazineExperienceClient latestIssue={latestIssue} />;
}
