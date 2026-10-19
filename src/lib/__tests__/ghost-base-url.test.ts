import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ENV_KEYS = [
  'NEXT_PUBLIC_GHOST_API_URL',
  'GHOST_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_GHOST_CONTENT_API_KEY',
  'GHOST_CONTENT_API_KEY',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const saved: Record<string, string | undefined> = {};

/** Replace the whole Ghost-related env surface so each case starts from a known state. */
function setEnv(values: Partial<Record<EnvKey, string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** Fresh module instance, because the content API key is read once at import time. */
async function loadGhost() {
  vi.resetModules();
  return import('../ghost');
}

describe('Ghost Content API base URL resolution', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calls only the configured Ghost host, never an apex/admin twin of the site origin', async () => {
    setEnv({
      NEXT_PUBLIC_GHOST_API_URL: 'https://admin.example.test',
      NEXT_PUBLIC_SITE_URL: 'https://example.test',
      GHOST_CONTENT_API_KEY: 'test-key',
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    const { getPosts } = await loadGhost();
    await getPosts({ limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://admin.example.test/ghost/api/content/posts/');
  });

  it('does not retry another host when the configured host fails', async () => {
    setEnv({
      NEXT_PUBLIC_GHOST_API_URL: 'https://admin.example.test',
      NEXT_PUBLIC_SITE_URL: 'https://example.test',
      GHOST_CONTENT_API_KEY: 'test-key',
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    vi.stubGlobal('fetch', fetchMock);

    const { getPosts } = await loadGhost();

    await expect(getPosts({ limit: 1 })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not treat the public site origin as a Ghost host when none is configured', async () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: 'https://yorkshirebusinesswoman.co.uk',
      GHOST_CONTENT_API_KEY: 'test-key',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { getPosts } = await loadGhost();

    await expect(getPosts({ limit: 1 })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses GHOST_API_URL when NEXT_PUBLIC_GHOST_API_URL is not set', async () => {
    setEnv({
      GHOST_API_URL: 'https://ghost-api.example.test',
      GHOST_CONTENT_API_KEY: 'test-key',
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    const { getPosts } = await loadGhost();
    await getPosts({ limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://ghost-api.example.test/ghost/api/content/posts/');
  });
});
