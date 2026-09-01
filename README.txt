DRAPER Command Center routing fix

This patch removes the role-based self-rewrite rules that caused /command/ to loop.
It replaces them with a Netlify Edge Function that checks Netlify Identity and the
"command" role before allowing any /command or /command/* request through.
