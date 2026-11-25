# Vaeron AI

Private movie studio. Pictures stay in the browser. AI clips run on the server and never start without an approval.

A picture is 70 to 120 minutes, assembled from clips of at most 15 seconds. A 70-minute picture on the cheaper model at 480p starts near $84. That is an estimate, not a quote.

Repository: [wexie-maker/Vaeron-](https://github.com/wexie-maker/Vaeron-)

## Run

```bash
npm install
npm run dev
```

Set `XAI_API_KEY` in the environment before you render. Do not commit it.

## Deploy on Vercel

1. Import this repo.
2. Add `XAI_API_KEY` as an environment variable. Leave it off the client.
3. Build command: `npm run build`.
4. Do not add a database unless you later turn on accounts. With no `DATABASE_URL`, the build skips migrations.

Anyone who can open the deployed app and render a clip spends the key on that project. Keep the deployment private until you want that.
