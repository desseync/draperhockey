import { logout, verifyRequestOrigin } from "@netlify/identity";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  try {
    verifyRequestOrigin(req);
    await logout();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: "Could not sign out." }, { status: 400 });
  }
};
