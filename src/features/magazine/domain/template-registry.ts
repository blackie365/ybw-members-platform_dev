import type { ComponentType } from "react";
import type { ReaderPage } from "./types";

export interface TemplateRenderProps {
  edition: {
    title: string;
    publishDate: string;
    coverImage: string;
    description: string;
  };
  page: ReaderPage;
  viewModel: Record<string, unknown>;
  imageVersion?: string;
}

interface TemplateRegistryEntry {
  render: ComponentType<TemplateRenderProps>;
  buildViewModel: (
    page: ReaderPage,
    edition: TemplateRenderProps["edition"],
  ) => Record<string, unknown>;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

const coverEntry: TemplateRegistryEntry = {
  render: null as any, // lazy loaded
  buildViewModel: (page, edition) => {
    const c = page.content;
    return {
      image: c.imageUrl || edition.coverImage,
      featureImage: c.imageUrl || edition.coverImage,
      headline: c.title || edition.title,
      subheadline: c.standfirst || edition.description,
      date: formatDate(edition.publishDate),
      issue: formatDate(edition.publishDate),
      badge: c.kicker || "",
      gallery: (c.imageUrls || []).map((src) => ({ src })),
    };
  },
};

const contentsEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page, edition) => {
    const c = page.content;
    return {
      title: c.title || "In This Issue",
      kicker: formatDate(edition.publishDate),
      items: c.items || [],
    };
  },
};

const featureEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page) => {
    const c = page.content;
    return {
      title: c.title || "",
      kicker: c.kicker || "Feature",
      name: c.name || c.author || "",
      intro: c.standfirst || "",
      text: c.body || "",
      featureImage: c.imageUrl || "",
      image: c.imageUrl || "",
      backgroundImage: c.backgroundImage || "",
      videoUrl: c.videoUrl || "",
      quote: c.quote || "",
      pullQuotes: c.pullQuotes || [],
      mediaLayout: c.mediaLayout || "",
      weight: c.weight,
      isContinuation: Boolean(c.isContinuation),
      continuationLabel: c.continuationLabel || "",
      snapshotLabel: c.snapshotLabel || "",
      gallery: (c.imageUrls || []).map((src) => ({ src })),
      stats: [],
    };
  },
};

const editorNoteEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page) => {
    const c = page.content;
    return {
      title: c.title || "Editor's Note",
      author: c.author || "",
      quote: c.quote || "",
      text: c.body || "",
      intro: c.standfirst || "",
      featureImage: c.imageUrl || "",
      image: c.imageUrl || "",
      pullQuotes: c.pullQuotes || [],
    };
  },
};

const adEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page) => {
    const c = page.content;
    return {
      image: c.imageUrl || "",
      label: c.label || "Advertisement",
      alt: c.title || "Advertisement",
      linkUrl: c.ctaHref || "",
    };
  },
};

const backCoverEntry: TemplateRegistryEntry = {
  render: null as any,
  buildViewModel: (page, edition) => {
    const c = page.content;
    return {
      title: c.title || edition.title,
      text: c.body || edition.description || "",
      featureImage: c.imageUrl || edition.coverImage,
      image: c.imageUrl || edition.coverImage,
      backgroundImage: c.backgroundImage || "",
      videoUrl: c.videoUrl || "",
      kicker: c.kicker || "Until Next Time",
      cta: c.ctaLabel || "Join the Community",
      linkUrl: c.ctaHref || "",
      nextIssue: c.nextIssue || "",
      socials: [],
    };
  },
};

const REGISTRY: Record<string, TemplateRegistryEntry> = {
  cover: coverEntry,
  contents: contentsEntry,
  "feature-left": featureEntry,
  "feature-right": featureEntry,
  "feature-full": featureEntry,
  "editor-note": editorNoteEntry,
  ad: adEntry,
  "back-cover": backCoverEntry,
};

export function getTemplateEntry(
  template: string,
): TemplateRegistryEntry | null {
  return REGISTRY[template] ?? null;
}

export function getTemplateViewModel(
  page: ReaderPage,
  edition: TemplateRenderProps["edition"],
): Record<string, unknown> {
  const entry = getTemplateEntry(page.template);
  return entry ? entry.buildViewModel(page, edition) : {};
}

export function getTemplateComponent(
  template: string,
): ComponentType<TemplateRenderProps> | null {
  return REGISTRY[template]?.render ?? null;
}

// Lazy load all template renderers (avoids circular deps)
let _loaded = false;
export function loadTemplateRenderers() {
  if (_loaded) return;
  _loaded = true;

  const CoverTemplate = require("../templates/cover/renderer").default;
  const ContentsTemplate = require("../templates/contents/renderer").default;
  const FeatureTemplate = require("../templates/feature/renderer").default;
  const EditorNoteTemplate =
    require("../templates/editor-note/renderer").default;
  const AdTemplate = require("../templates/ad/renderer").default;
  const BackCoverTemplate = require("../templates/back-cover/renderer").default;

  // Override the render function on each entry
  // The template renderers still expect TemplateRenderProps with the old shape,
  // so we wrap them to adapt
  coverEntry.render = CoverTemplate;
  contentsEntry.render = ContentsTemplate;
  featureEntry.render = FeatureTemplate;
  editorNoteEntry.render = EditorNoteTemplate;
  adEntry.render = AdTemplate;
  backCoverEntry.render = BackCoverTemplate;
}
