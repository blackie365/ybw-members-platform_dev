"use client";

const MAGAZINE_MUTATION_EVENT_TYPE = "ybw:magazine-mutation";
const BROADCAST_CHANNEL_NAME = "ybw-magazine-edition-bus";

export type MagazineMutationType =
  | "page-reordered"
  | "page-deleted"
  | "page-saved"
  | "page-type-changed"
  | "pages-all-deleted"
  | "page-added"
  | "issue-saved"
  | "story-library-saved"
  | "reader-edition-synced";

export interface MagazineMutationPayload {
  issueId: string;
  editionId: string | null;
  mutationType: MagazineMutationType;
  timestamp: number;
  renderVersion: number;
  pageDocId?: string | null;
  slug?: string | null;
}

export interface MagazineMutationEvent extends Event {
  detail?: MagazineMutationPayload;
}

let renderVersionCounter = 0;

const singletonBus: EventTarget | null =
  typeof EventTarget !== "undefined" ? new EventTarget() : null;

const sharedBroadcastChannel: BroadcastChannel | null =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    : null;

if (sharedBroadcastChannel && typeof window !== "undefined") {
  sharedBroadcastChannel.onmessage = (event: MessageEvent) => {
    const payload = event?.data as MagazineMutationPayload | null | undefined;
    if (!payload || !payload.issueId) return;
    void dispatchLocal(payload);
  };
}

function matchesIssue(
  subscriptionId: string,
  payloadIssueId: string,
  payloadEditionId: string | null,
): boolean {
  const needle = String(subscriptionId || "").trim();
  if (!needle) return false;
  if (String(payloadIssueId || "") === needle) return true;
  if (payloadEditionId && String(payloadEditionId) === needle) return true;
  return false;
}

export function emitMagazineMutation(
  params: Omit<MagazineMutationPayload, "timestamp" | "renderVersion"> & {
    timestamp?: number;
    renderVersion?: number;
  },
): MagazineMutationPayload {
  renderVersionCounter += 1;
  const payload: MagazineMutationPayload = {
    issueId: String(params.issueId || "").trim(),
    editionId: params.editionId ? String(params.editionId).trim() : null,
    mutationType: params.mutationType,
    pageDocId: params.pageDocId ? String(params.pageDocId) : undefined,
    slug: params.slug ? String(params.slug).trim() : undefined,
    timestamp:
      typeof params.timestamp === "number" && Number.isFinite(params.timestamp)
        ? params.timestamp
        : Date.now(),
    renderVersion:
      typeof params.renderVersion === "number" && Number.isFinite(params.renderVersion)
        ? params.renderVersion
        : renderVersionCounter,
  };
  if (!payload.issueId) {
    console.warn("[emitMagazineMutation] missing issueId; skipping broadcast");
    return payload;
  }
  void dispatchLocal(payload);
  if (sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel.postMessage(payload);
    } catch {
      /* ignored for opaque or unserializable payloads */
    }
  }
  return payload;
}

function dispatchLocal(payload: MagazineMutationPayload): void {
  if (!singletonBus) return;
  try {
    const event: MagazineMutationEvent = new CustomEvent(MAGAZINE_MUTATION_EVENT_TYPE, {
      detail: payload,
      cancelable: false,
      bubbles: false,
    });
    singletonBus.dispatchEvent(event);
  } catch {
    /* no-op on unsupported environments */
  }
}

export function subscribeMagazineMutations(
  id: string,
  callback: (payload: MagazineMutationPayload) => void,
): () => void {
  if (!singletonBus || typeof id !== "string" || !id) {
    return () => undefined;
  }
  const listener = (ev: Event) => {
    const event = ev as MagazineMutationEvent;
    const payload = event?.detail;
    if (!payload || !payload.issueId) return;
    if (!matchesIssue(id, payload.issueId, payload.editionId)) return;
    try {
      callback(payload);
    } catch (err) {
      console.warn("[subscribeMagazineMutations] listener error:", err);
    }
  };
  singletonBus.addEventListener(MAGAZINE_MUTATION_EVENT_TYPE, listener as EventListener);
  return () => {
    singletonBus?.removeEventListener(
      MAGAZINE_MUTATION_EVENT_TYPE,
      listener as EventListener,
    );
  };
}

export function getCurrentMagazineRenderVersion(): number {
  return renderVersionCounter;
}

export function resetMagazineEventStateForTests(): void {
  renderVersionCounter = 0;
}
