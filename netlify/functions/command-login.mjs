import { login, verifyRequestOrigin } from "@netlify/identity";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  try {
    verifyRequestOrigin(req);
    const body = await req.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !password) {
      return Response.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    }

    await login(email, password);
    return Response.json({ ok: true });
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || 401;
    return Response.json(
      { ok: false, error: status === 403 ? "Request blocked." : "Invalid email or password." },
      { status: status === 403 ? 403 : 401 }
    );
  }
};
