# Changelog

## 0.1.0 (2026-11-14)

The first release.

- Share a secret with one link per recipient. Each link shows it once, behind a button press.
- AES-256-GCM in the browser; the key travels in the link's `#fragment` and never reaches the server.
- The encrypted data is deleted when every recipient has seen it, when it expires (at most 7 days),
  or when its creator revokes it. The remaining record goes 30 days later.
- Creators sign in with an emailed one-time link; only addresses on an allowlist can.
- One SQLite file, one Node process. Docker image and compose file included.
- English and Swedish.
