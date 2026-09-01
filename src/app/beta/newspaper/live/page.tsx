import { PageNewspaperSpread, PageNewspaperCover, PageNewspaperContents } from "@/features/magazine/templates/shared";
import { realStPetersPage, realMediationPage, realCoverPage, realContentsPage } from "../live-data";

export const metadata = {
  title: "Newspaper Spread — Live Data | Yorkshire BusinessWoman",
};

const stPetersSummary = {
  pageId: "st-peters",
  position: 7,
  title: realStPetersPage.title,
  kicker: "Feature",
  standfirst: realStPetersPage.standfirst.slice(0, 140),
  featureImage: realStPetersPage.featureImage,
};

const mediationSummary = {
  pageId: "mediation",
  position: 2,
  title: "Mediation is the diplomatic alternative to workplace tribunals",
  kicker: "Law",
  standfirst: realMediationPage.standfirst.slice(0, 140),
  featureImage: "",
};

/**
 * Newspaper spread rendered with 100% REAL live content from the Summer 2026
 * read store, using the exact production PageNewspaperSpread component — which
 * is now the DEFAULT for every feature page in the reader. Two pages shown to
 * demonstrate variety: an image-led feature and a no-image article, plus the
 * "More from this edition" cross-linking strip.
 *
 * Also renders the new broadsheet FRONT-OF-BOOK: the cover (PageNewspaperCover)
 * and the contents page (PageNewspaperContents), both against live-producing
 * view-models, to prove the whole edition reads as a newspaper.
 */
export default function NewspaperLivePage() {
  return (
    <div>
      {/* Front of book — broadsheet cover */}
      <PageNewspaperCover data={realCoverPage} imageVersion={""} />
      <div className="h-px w-full bg-[#a3413a]" />

      {/* Front of book — broadsheet contents */}
      <PageNewspaperContents data={realContentsPage} imageVersion={""} editionSlug="yorkshire-business-woman-summer-2026-edition" />
      <div className="h-px w-full bg-[#a3413a]" />

      {/* Feature spreads */}
      <PageNewspaperSpread
        data={realStPetersPage}
        imageVersion={""}
        siblings={[mediationSummary]}
      />
      <div className="h-px w-full bg-[#a3413a]" />
      <PageNewspaperSpread
        data={realMediationPage}
        imageVersion={""}
        siblings={[stPetersSummary]}
      />
    </div>
  );
}
