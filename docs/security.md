# Security

## Implemented

- Passwords use Node.js `scrypt` with a random per-password salt and timing-safe comparison.
- Session tokens are random and only their HMAC-SHA-256 hashes are persisted. Browser cookies are HttpOnly and SameSite=Lax; Secure is enabled in production.
- Registration/login payloads are validated and authentication failure text is generic.
- Same-origin checks reject cross-origin state-changing requests when an Origin header is present.
- API reads require an authenticated session and object-level agreement ownership checks.
- IDs and agreement clauses are not included in the dashboard list response.
- Default response headers include frame, MIME-sniffing, referrer, and browser permission protections.
- Agreement content and event history use SHA-256 hashes; current-version creation is transactional.
- Signing invitations use random one-time bearer tokens stored as HMAC hashes. Counterparty verification codes are short-lived, HMAC-protected, limited to five attempts, and sent through Resend; verified signing sessions use hashed opaque tokens in HttpOnly cookies.
- Both signature records bind a typed name, timestamp, and the immutable content fingerprint. The agreement is finalized only after both parties sign.

## Not yet implemented / required before production

- Distributed rate limiting, MFA/step-up authentication, issuer invitation rate limiting, session management UI, CSRF token strategy for any future cross-site cookie use, CSP/nonces, security monitoring, dependency scanning, malware scanning, upload restrictions, private object storage, key management, backup/restore drills, admin RBAC, and full security tests.
- Email-code verification proves access to an email account, not the recipient's civil identity. Typed in-app signatures are not qualified digital signatures and have not undergone independent legal or security review.
- This MVP has not undergone independent security or penetration testing.
- The hash chain does not prevent an infrastructure administrator from rewriting the database and recomputing hashes.
- Do not collect sensitive identity data until application-level encryption, purpose, access, retention, lawful basis, and legal review are in place.
