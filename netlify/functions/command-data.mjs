import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const STORE_NAME = "draper-command-center";
const MAX_BYTES = 1_500_000;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default async (req) => {
  const user = await getUser();
  if (!user) return json({ ok: false, error: "Unauthorized" }, 401);

  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.includes("command")) return json({ ok: false, error: "Forbidden" }, 403);

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const key = `users/${user.id}/state.json`;

  if (req.method === "GET") {
    const state = await store.get(key, { type: "json", consistency: "strong" });
    return json({ ok: true, state: state || null });
  }

  if (req.method === "PUT") {
    try {
      verifyRequestOrigin(req);
      const contentLength = Number(req.headers.get("content-length") || 0);
      if (contentLength > MAX_BYTES) return json({ ok: false, error: "Command Center data is too large." }, 413);

      const state = await req.json();
      if (!state || typeof state !== "object" || Array.isArray(state)) {
        return json({ ok: false, error: "Invalid data." }, 400);
      }

      const serialized = JSON.stringify(state);
      if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) {
        return json({ ok: false, error: "Command Center data is too large." }, 413);
      }

      state._meta = {
        ...(state._meta || {}),
        version: 3,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email
      };

      await store.setJSON(key, state, {
        metadata: { updatedAt: state._meta.updatedAt, userId: user.id }
      });

      return json({ ok: true, updatedAt: state._meta.updatedAt });
    } catch (error) {
      return json({ ok: false, error: "Could not save Command Center data." }, 400);
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, PUT" } });
};
