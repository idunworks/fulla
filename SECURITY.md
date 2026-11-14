# Security

## Reporting a problem

Please report security problems privately, through this repository's
**Security → Report a vulnerability** button on GitHub. Don't open a public issue.
You'll get an answer within a week.

## What Fulla protects, and what it doesn't

Fulla is for handing over a password or a key without leaving it in an inbox or a chat
history. The design rests on one rule: **the server never holds anything that can decrypt
a secret.**

### What the server can't do

- **Read a secret.** The browser encrypts it (AES-256-GCM, a fresh 256-bit key and IV each
  time) before sending it. The key is in the part of the link after `#`, which browsers never
  send to a server, so it isn't in any request, access log or proxy log.
- **Rebuild a link.** Each recipient's token is stored only as a SHA-256 hash. The links are
  shown once, to the creator, when the secret is made.
- **Keep a secret around.** The ciphertext is deleted at the last recipient's reveal, at
  expiry (at most 7 days), or on revoke. SQLite's `secure_delete` overwrites the freed pages,
  and the write-ahead log is folded back every 10 minutes.

### What a link does

- Opening a link shows a button and spends nothing. Mail and chat scanners that open every
  link can't use it up. The ciphertext is sent only when the recipient presses the button,
  once per link; a second try answers that the link is used.
- The page removes the `#…` from the address bar at once, so it isn't left in history or
  copied along with the address.

### What Fulla can't protect against

- **Someone who gets the whole link before the recipient opens it.** The link is the key. Send
  it the way you'd send the secret's location: to the right person, through a channel you
  trust. Each recipient gets their own link, so the creator's page shows whose link was used.
- **A compromised recipient device, or a compromised server.** Someone who controls the server
  can change the JavaScript it serves and capture secrets typed in later. That is true of every
  web-based end-to-end tool; run Fulla on a machine you trust.
- **A creator's inbox taken over.** Sign-in is by emailed link, so whoever reads the creator's
  mail can sign in as them. A creator's session can't read secrets (the server has no keys),
  but it can see the titles and recipient names they chose, create secrets and revoke them.
- **Metadata.** The server knows when a secret was made and opened, its title, the names and
  optional email addresses the creator typed for recipients, and visitors' IP addresses for
  rate limiting. Don't put secrets in titles.

### Sign-in

- Only addresses on `FULLA_ALLOWED_EMAILS` can sign in, and every address gets the same answer.
  The email is sent after the answer. Asking for a link for a listed address does a few
  database writes that an unlisted one doesn't; the difference is well under a millisecond,
  and the rate limit makes it impractical to measure.
- Sign-in links work once, for 15 minutes, and travel in the `#fragment`. Only hashes are stored.
- Sessions are random ids in an `httpOnly`, `SameSite=Strict` cookie (`__Host-` prefixed over
  HTTPS), stored as hashes, ended at sign-out on the server too, and checked against the
  allowlist on every request.
- Links in the emails are built from `ORIGIN`, never from the request's `Host` header.

### The browser side

- A strict Content Security Policy: no inline scripts or styles, nothing loaded from other
  sites, no framing. No analytics, no external fonts.
- `Referrer-Policy: no-referrer` everywhere; `Cache-Control: no-store` on every page and
  answer that may carry a secret or a link.
- State-changing requests must come from Fulla's own origin and be JSON.
