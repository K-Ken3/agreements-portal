# User flows

## Available now

1. Register with a legal name, email, and password of at least 12 characters. Registration creates a session.
2. Sign in with email and password; logout revokes the active session.
3. Open the authenticated dashboard and see private issuer drafts.
4. Create a draft with title, category, description, agreement terms, RWF currency, effective date, and signing deadline.
5. The server persists the agreement, canonical content snapshot, SHA-256 fingerprint, and initial audit event transactionally.
6. Open an agreement detail page and see its current draft content and workflow status.

## Later phases

Invitation, phone OTP, recipient completion, review/change requests, revised versions, locking, independent signatures, PDF generation, authorized downloads, public verification, notification delivery, identity data, and admin operations are not implemented. UI controls for these features are not presented as working actions.

The legal and privacy pages are visibly marked as drafts pending qualified review.
