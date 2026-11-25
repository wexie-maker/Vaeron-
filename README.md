# Vaeron AI

Private movie studio. Pictures stay in the browser. AI clips run on the server and never start without an approval.

A picture is 70 to 120 minutes, assembled from clips of at most 15 seconds. A 70-minute picture on the cheaper model at 480p starts near $84. That is an estimate, not a quote.

## Run

```bash
npm install
npm run dev
```

Set `XAI_API_KEY` in the environment before you render. Do not commit it.

## Create the GitHub repo

The code in this project is not on GitHub until this is done. The connected GitHub account is `wexie-maker`. That connection can push to a repo it is allowed to see. It cannot create the repo.

1. Sign in to GitHub as [wexie-maker](https://github.com/wexie-maker).
2. Open [github.com/new](https://github.com/new).
3. Set the owner to `wexie-maker` and the repository name to `vaeron`.
4. Choose **Private**.
5. Leave **Add a README**, **Add .gitignore**, and **Choose a license** off. The repo must be empty so the existing commit can be pushed.
6. Click **Create repository**.
7. Grant this chat access to that repo:
   - Open [github.com/settings/installations](https://github.com/settings/installations).
   - Open the Grok GitHub app and choose **Configure**.
   - Under **Repository access**, select **Only select repositories** and add `vaeron`. If the choice is **All repositories**, that also works.
   - Save.
8. Reply in this chat that the repo is ready. The `main` branch (commit `7fe08bb`) gets pushed then.

Do not put `XAI_API_KEY` in the repo.

## Deploy on Vercel

1. Import this repo.
2. Add `XAI_API_KEY` as an environment variable. Leave it off the client.
3. Build command: `npm run build`.
4. Do not add a database unless you later turn on accounts. With no `DATABASE_URL`, the build skips migrations.

Anyone who can open the deployed app and render a clip spends the key on that project. Keep the deployment private until you want that.
