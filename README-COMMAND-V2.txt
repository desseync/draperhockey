DRAPER COMMAND V2 — SOCIAL + PARTNERS + MERCH + MONEY

This patch upgrades the existing secure Draper Command Center. It does NOT change
the login / Edge Function gate. Your existing private data remains in Netlify Blobs.
The browser migrates the existing state to the new schema and keeps the old data.

New sections
------------
- Social / Growth: accounts, follower goals, performance snapshots, post tracker
- Partners: CRM-style sponsor / travel pipeline with cash + in-kind value
- Merch: product goals, units sold, revenue, cost and profit
- Money / Offset: hockey costs vs partner value, merch profit and other offsets
- Dashboard: audience, partner value, merch profit and hockey-cost-offset metrics

Install
-------
Extract this ZIP into the root of the draperhockey project, overwriting matching files.
Then commit and push to GitHub. Netlify will deploy automatically.

Security
--------
Do not store social passwords, payment credentials, API keys, or other secrets in
Draper Command. Keep secrets in the appropriate provider / Netlify environment variables.
