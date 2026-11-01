# User flows

## Available now

1. Register with a legal name, email, and password of at least 12 characters. Registration creates a session.
2. Sign in with email and password; logout revokes the active session.
3. Open the authenticated dashboard and see private issuer drafts.
4. Create a draft with title, category, description, agreement terms, RWF currency, effective date, signing deadline, and the other party's name/email.
5. Review and lock the complete draft version, then email the other party a private signing link and one-time code.
6. The recipient verifies the email code, reads the locked terms, types their listed name, and explicitly consents to sign.
7. The issuer signs while authenticated. Either party may sign first; only the second signature finalises the agreement.
8. The server records each signature against the locked version's content hash, timestamps it, and adds a chained audit event. The issuer can view the signing record.

## Remaining phases

PDF generation, authorized downloads, public verification, review/change requests after invitation, amendments, phone/identity verification, and admin operations are not implemented. Email-code verification confirms access to the recipient email account; it does not independently verify identity. In-app typed signatures are not represented as qualified digital signatures or guaranteed legally enforceable.

The legal and privacy pages are visibly marked as drafts pending qualified review. Configure Resend (`RESEND_API_KEY`, `EMAIL_FROM`) before requesting signatures.
