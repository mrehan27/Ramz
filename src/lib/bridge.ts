/**
 * RAMZ runs two ways: inside Electron (IPC, no port) and in a browser against the
 * local HTTP server. Everything above this file is written once and works in both.
 */
type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

type Bridge = Record<string, (...args: unknown[]) => Promise<Reply<unknown>>> & {
  isPanel: boolean;
  openMainWindow: () => Promise<void>;
  hidePanel: () => Promise<void>;
};

const bridge = (globalThis as { ramz?: Bridge }).ramz;

export const inApp = Boolean(bridge);
export const inPanel = Boolean(bridge?.isPanel);
export const openMainWindow = () => bridge?.openMainWindow();
export const hidePanel = () => bridge?.hidePanel();

/** IPC when we have it, HTTP when we do not. */
export async function call<T>(
  channel: string,
  args: unknown[],
  http: { url: string; method?: string; body?: unknown },
): Promise<T> {
  if (bridge) {
    const reply = (await bridge[channel](...args)) as Reply<T>;
    if (!reply.ok) throw new Error(reply.error);
    return reply.value;
  }
  const res = await fetch(http.url, {
    method: http.method ?? "GET",
    headers: http.body === undefined ? undefined : { "content-type": "application/json" },
    body: http.body === undefined ? undefined : JSON.stringify(http.body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "request failed");
  }
  return res.json() as Promise<T>;
}
