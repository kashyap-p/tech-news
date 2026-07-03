import { cookies } from "next/headers";

/**
 * Session helper. For this portfolio project we use a lightweight anonymous
 * session id stored in a cookie so bookmarks + chat history persist per-browser
 * without requiring full auth.
 *
 * NOTE: In Next.js 16 `cookies()` returns a Promise and must be awaited.
 */
export const SESSION_COOKIE = "tn_session";

export async function getOrCreateSessionId(): Promise<string> {
  const store = await cookies();
  let id = store.get(SESSION_COOKIE)?.value;
  if (!id) {
    id = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    store.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return id;
}
