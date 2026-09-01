import { getUser } from "@netlify/identity";

export default async (request, context) => {
  const url = new URL(request.url);
  const user = await getUser();
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (!user || !roles.includes("command")) {
    const loginUrl = new URL("/command-login/", request.url);
    loginUrl.searchParams.set("next", url.pathname);
    return Response.redirect(loginUrl, 302);
  }

  // Canonicalize the authenticated command root once, without a redirect rule loop.
  if (url.pathname === "/command") {
    return Response.redirect(new URL("/command/", request.url), 308);
  }

  return context.next();
};

export const config = {
  path: ["/command", "/command/*"],
};
