DRAPER HOCKEY — SECURE COMMAND CENTER V1
========================================

WHAT THIS PATCH DOES
- Adds https://draperhockey.com/command/
- Adds a separate login screen at /command-login/
- Uses Netlify Identity for real user authentication
- Uses the Identity role "command" to gate the path at Netlify's CDN edge
- Uses Netlify Functions to verify authorization again before data access
- Stores dashboard data in Netlify Blobs, NOT in GitHub
- Adds a dedicated Film / Klevr system
- Adds Watchlist, Roadmap, Development, Network, Partners/Travel, Budget, Website and Notes
- Adds noindex/noarchive and no-store headers

IMPORTANT
This patch contains NO private Draper planning data. That is intentional because the GitHub repo is public.
Import the separate private seed JSON only AFTER you log into the live Command Center.
Do not copy that seed JSON into the draperhockey Git repository.

INSTALL INTO YOUR LOCAL HUGO PROJECT
1. Extract this patch.
2. Copy its contents into:
   C:\Users\17034\draperhockey
   Allow it to merge/overwrite matching files.
3. From PowerShell in that folder:

   git add .
   git commit -m "Add secure Draper Command Center"
   git push

Netlify will install the package.json dependencies and redeploy automatically.

NETLIFY IDENTITY SETUP
1. Open your Draper Hockey project in Netlify.
2. Go to Project configuration > Identity and enable Netlify Identity.
3. Set Registration preference to INVITE ONLY.
4. Invite only the email account(s) that should access Draper Command.
5. Accept the invitation and establish the account/password.
6. In Netlify Identity, open that user and add the role exactly:

   command

7. Sign out and sign back in after assigning the role. Role changes take effect on a fresh login/token.

OPEN IT
https://draperhockey.com/command/

If you are not authenticated, Netlify serves the command login page instead.

FIRST-TIME DATA LOAD
1. Sign into /command/.
2. Click IMPORT.
3. Choose the separate file: draper-command-private-seed-v1.json
4. The browser uploads that data through the authorized Netlify Function into your private Netlify Blob store.
5. Export backups periodically from the top-right EXPORT button.

PRIVACY
The user interface source is public because your GitHub repository is public.
The private dashboard DATA is not in the repo. It is only returned by a Function after Identity authorization.
The /command/* route is additionally gated with the "command" role.

Still avoid storing passwords, home address, school, hotel room numbers, or precise live location in this dashboard.
For travel, store plans at the level actually needed to manage the hockey operation.
