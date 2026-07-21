import type { AutoFillSlotsResult, FlatplanPage, Slot, Story } from './types';

interface AutoFillInput {
  pages: FlatplanPage[];
  slots: Slot[];
  stories: Story[];
}

function scoreStoryForSlot(story: Story, slot: Slot, page: FlatplanPage): number {
  if (story.status !== 'approved' && story.status !== 'candidate') return -1;
  if (story.includedInEditionCandidatePool === false) return -1;
  if (slot.contentType !== 'story' && slot.contentType !== 'editorial_note') return -1;

  const placementRules = slot.placementRules;
  if (placementRules?.requiredSource && story.source !== placementRules.requiredSource) {
    return -1;
  }

  if (placementRules?.excludesStoryIds?.includes(story.id)) {
    return -1;
  }

  let score = 0;
  const storyTags = new Set(story.tags.map((tag) => tag.toLowerCase()));

  if (placementRules?.acceptsStoryTags?.length) {
    const matchingTags = placementRules.acceptsStoryTags.filter((tag) => storyTags.has(tag.toLowerCase()));
    if (matchingTags.length === 0) return -1;
    score += matchingTags.length * 20;
  }

  switch (page.intent) {
    case 'cover':
      if (storyTags.has('cover')) score += 60;
      if (storyTags.has('lead') || storyTags.has('featured')) score += 30;
      if (storyTags.has('editorial') || storyTags.has('editor-note')) score -= 20;
      break;
    case 'editor_note':
      if (storyTags.has('editorial') || storyTags.has('editor-note')) score += 70;
      if (storyTags.has('cover')) score += 10;
      break;
    case 'feature_primary':
      if (storyTags.has('feature') || storyTags.has('lead')) score += 40;
      if (storyTags.has('interview') || storyTags.has('profile')) score += 10;
      break;
    case 'feature_secondary':
      if (storyTags.has('feature') || storyTags.has('secondary')) score += 30;
      break;
    case 'feature_supporting':
      if (storyTags.has('feature') || storyTags.has('supporting')) score += 20;
      break;
    default:
      break;
  }

  if (story.heroImage?.src) score += 5;
  if (story.pullQuotes?.length) score += 5;
  if (typeof story.priority === 'number') score += story.priority;
  if (typeof story.placementConfidence === 'number') score += Math.round(story.placementConfidence * 10);

  return score;
}

export function autoFillSlots({ pages, slots, stories }: AutoFillInput): {
  slots: Slot[];
  result: AutoFillSlotsResult;
} {
  const pageMap = new Map(pages.map((page) => [page.id, page]));
  const orderedSlots = [...slots].sort((a, b) => {
    const pageA = pageMap.get(a.flatplanPageId);
    const pageB = pageMap.get(b.flatplanPageId);
    return (pageA?.position ?? 0) - (pageB?.position ?? 0);
  });

  const usedStoryIds = new Set(
    orderedSlots.map((slot) => slot.binding?.storyId).filter((storyId): storyId is string => Boolean(storyId)),
  );

  const unresolvedSlots: string[] = [];
  const warnings: string[] = [];
  let filledSlots = 0;

  const nextSlots = orderedSlots.map((slot) => {
    if (slot.binding?.storyId || (slot.contentType !== 'story' && slot.contentType !== 'editorial_note')) {
      if (slot.isRequired && !slot.binding?.storyId && slot.contentType !== 'story' && slot.contentType !== 'editorial_note') {
        warnings.push(`Slot ${slot.key} requires manual content type ${slot.contentType}.`);
      }
      return slot;
    }

    const page = pageMap.get(slot.flatplanPageId);
    if (!page) {
      unresolvedSlots.push(slot.id);
      warnings.push(`Slot ${slot.key} could not resolve its parent page.`);
      return slot;
    }

    const candidate = stories
      .filter((story) => !usedStoryIds.has(story.id))
      .map((story) => ({ story, score: scoreStoryForSlot(story, slot, page) }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score)[0];

    if (!candidate) {
      if (slot.isRequired) unresolvedSlots.push(slot.id);
      return {
        ...slot,
        automationConfidence: 0,
        reviewReason: slot.isRequired ? 'No eligible story candidate matched this required slot.' : undefined,
      };
    }

    usedStoryIds.add(candidate.story.id);
    filledSlots += 1;

    return {
      ...slot,
      bindingMode: slot.bindingMode ?? 'auto',
      binding: {
        ...slot.binding,
        storyId: candidate.story.id,
      },
      automationConfidence: candidate.score,
      reviewReason: undefined,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    slots: nextSlots,
    result: {
      filledSlots,
      unresolvedSlots,
      warnings,
    },
  };
}
