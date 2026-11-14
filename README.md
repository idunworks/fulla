# Fulla

Share a password once: Fulla encrypts it in your browser, gives each recipient their own link that shows it a single time, then deletes it. Self-hosted, for teams who don't want secrets left in inboxes and chat logs. More from where it came from: [idunworks.com/projects](https://idunworks.com/projects?utm_source=github&utm_medium=readme&utm_campaign=fulla)

![Creating a secret, copying a recipient's link, and the recipient revealing it once](docs/demo.gif)

## Install

```bash
git clone https://github.com/idunworks/fulla.git && cd fulla
cp config.example.env .env   # set ORIGIN, FULLA_ALLOWED_EMAILS, FULLA_SMTP_URL
docker compose up -d
```

Then put HTTPS in front of it: see [docs/self-hosting.md](docs/self-hosting.md).

## Try it in 30 seconds

No Docker, no email server. Needs Node 22 and pnpm.

```bash
pnpm install
FULLA_ALLOWED_EMAILS=you@example.com pnpm dev
```

Open http://localhost:5173/auth and enter `you@example.com`. In development the sign-in email is
printed in the terminal instead of sent:

```
fulla: email to you@example.com (console mailer)
Subject: Your sign-in link for Fulla

Sign in to Fulla with this link:

http://localhost:5173/auth#token=Xq3v…

It works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.
```

Open that link, press **Sign in**, write a secret, add a recipient, and open their link in a
private window. Press **Show secret** once; open the link again and it says it has been used.

## Configuration

Everything is set through environment variables; [config.example.env](config.example.env) lists
them all with comments.

| Setting | Default | What it does |
|---|---|---|
| `ORIGIN` | (required in production) | The public `https://` address. Sign-in links point here. |
| `FULLA_ALLOWED_EMAILS` | empty: nobody | Who may sign in and create secrets: addresses and `@domains`, comma-separated. |
| `FULLA_SMTP_URL` | none | `smtp://user:pass@host:587` or `smtps://…:465` for sign-in emails. |
| `FULLA_MAIL_FROM` | `Fulla <fulla@localhost>` | The sender of those emails. |
| `FULLA_MAIL_CONSOLE` | `false` (`true` in `pnpm dev`) | Print sign-in emails to the log instead. For trying it out only. |
| `FULLA_DATABASE` | `./data/fulla.db` (`/data/fulla.db` in Docker) | The SQLite file. |
| `FULLA_LANG` | each visitor's browser | Pin `en` or `sv` for everyone. |
| `ADDRESS_HEADER`, `XFF_DEPTH` | not set | Behind a proxy: where the visitor's address is, for rate limits. |

Fixed rules: a secret is at most 64 KiB, has 1 to 25 recipients, and lives 5 minutes to 7 days.

## Turn it off

- **Revoke one secret:** its page has a **Revoke** button. Every link stops working and the
  encrypted data is deleted at once.
- **Stop Fulla:** `docker compose down`. Links already sent stop working while it's down.
- **Remove it:** `docker compose down -v` deletes the volume, which is everything Fulla stored.
  Nothing is left anywhere else: no external services, no analytics.

## How it works

1. The creator's browser makes a random AES-256-GCM key, encrypts the secret and sends only the
   ciphertext. The server answers with one random token per recipient and keeps only their hashes.
2. Each link is `https://…/view#t=<token>&key=<key>`. Browsers never send the part after `#`,
   so neither the token nor the key is in any request line or log.
3. Opening the link shows a button and spends nothing, so mail scanners can't use it up.
   Pressing it fetches the ciphertext once for that token, and the browser decrypts it.
4. When every recipient has seen it, at expiry, or on revoke, the ciphertext is deleted.

The threat model, including what Fulla can't protect against, is in [SECURITY.md](SECURITY.md).

## Built at idunworks

Fulla came out of building [Idun CMS](https://idunworks.com/projects?utm_source=github&utm_medium=readme&utm_campaign=fulla), the platform behind
idunworks.com and the sites it hosts, where it's the tool we use to hand over passwords.
More projects: [idunworks.com/projects](https://idunworks.com/projects?utm_source=github&utm_medium=readme&utm_campaign=fulla).

[![idunworks](https://img.shields.io/badge/built%20at-idunworks-black)](https://idunworks.com/projects?utm_source=github&utm_medium=badge&utm_campaign=fulla)

## License

MIT
