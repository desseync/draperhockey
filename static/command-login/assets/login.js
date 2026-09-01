const form = document.getElementById("loginForm");
const button = document.getElementById("submitBtn");
const message = document.getElementById("message");

async function session() {
  try {
    const res = await fetch("/.netlify/functions/command-session", { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

(async () => {
  const s = await session();
  if (s?.canAccessCommand) location.replace("/command/");
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  message.className = "message";
  message.textContent = "Signing in…";
  try {
    const res = await fetch("/.netlify/functions/command-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Sign in failed.");

    const s = await session();
    if (!s?.canAccessCommand) {
      message.textContent = "Signed in, but this account does not have the command role yet. Assign the role in Netlify Identity, then sign out/in again.";
      return;
    }
    message.className = "message ok";
    message.textContent = "Access granted.";
    location.replace("/command/");
  } catch (error) {
    message.textContent = error.message || "Sign in failed.";
  } finally {
    button.disabled = false;
  }
});
