# Running Fulla on your own server

Fulla is one Node process and one SQLite file. Put it behind a TLS proxy, give it a way to send
email, and back up one volume.

## 1. Configure

```bash
cp config.example.env .env
```

Set at least `ORIGIN`, `FULLA_ALLOWED_EMAILS` and `FULLA_SMTP_URL`. Every setting is explained
in [config.example.env](../config.example.env).

## 2. Start it

```bash
docker compose up -d
```

The compose file publishes port 3000 on `127.0.0.1` only, runs the container as a non-root user
with a read-only filesystem and no Linux capabilities, and keeps the database in the
`fulla-data` volume.

Without Docker: Node 22, then `pnpm install && pnpm build && node build`, with the same settings
in the environment.

## 3. Put HTTPS in front

Fulla must be served over HTTPS: the browser's encryption API only works on secure origins
(and on `localhost`). Any reverse proxy works. With Caddy:

```
fulla.example.com {
	reverse_proxy 127.0.0.1:3000
}
```

With nginx, pass the visitor's address on:

```nginx
location / {
	proxy_pass http://127.0.0.1:3000;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-For $remote_addr;
	proxy_set_header X-Forwarded-Proto https;
}
```

### The visitor's address

Rate limits count per visitor. Behind a proxy, Fulla only sees the proxy, so tell it which
header carries the real address:

```
ADDRESS_HEADER=X-Forwarded-For
XFF_DEPTH=1
```

`XFF_DEPTH` is the number of proxies you run in front of Fulla. Set `ADDRESS_HEADER` only when
a proxy you control always sets that header; otherwise a visitor could write their own and
dodge the limit. Decide the address in one place (here), and nowhere else.

Don't let the proxy log full URLs with query strings if you add any: Fulla itself never puts a
secret in a URL path or query, only in the `#fragment`, which never reaches the proxy.

## 4. Email

`FULLA_SMTP_URL` takes a normal SMTP URL: `smtp://user:pass@host:587` (STARTTLS) or
`smtps://user:pass@host:465`. URL-encode special characters in the password. Set
`FULLA_MAIL_FROM` to an address your mail provider lets you send from, and set up SPF and DKIM
for its domain, or sign-in links will land in spam.

To try Fulla without email, `FULLA_MAIL_CONSOLE=true` prints the sign-in links to the log
(`docker compose logs fulla`). Turn it off before anyone else can read that log.

## 5. Backups

Everything is in the `fulla-data` volume: `fulla.db` and, while it runs, `fulla.db-wal`. To take
a consistent copy without stopping Fulla:

```bash
docker compose exec fulla node -e "require('better-sqlite3')('/data/fulla.db').backup('/data/backup.db').then(() => console.log('ok'))"
docker compose cp fulla:/data/backup.db ./fulla-backup.db
```

A backup holds ciphertext, hashes, titles and recipient names, never a key. Restoring an old
backup can bring back ciphertext that has since been deleted; it still can't be read without
its link, but treat backups as sensitive and keep them no longer than you need. (Secrets live
at most 7 days.)

## 6. Updating

```bash
git pull && docker compose up -d --build
```

The database schema updates itself on start.

## Turning it off

`docker compose down` stops it. `docker compose down -v` also deletes the volume, and with it
every secret, link and session. Links already sent stop working.
