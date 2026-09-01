import { getUser } from "@netlify/identity";

export default async () => {
  const user = await getUser();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });

  return Response.json({
    authenticated: true,
    email: user.email,
    roles: Array.isArray(user.roles) ? user.roles : [],
    canAccessCommand: Array.isArray(user.roles) && user.roles.includes("command")
  });
};
