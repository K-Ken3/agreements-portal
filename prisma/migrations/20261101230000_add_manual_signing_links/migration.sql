ALTER TABLE "agreement_signers"
    ADD COLUMN "email_verification_required" BOOLEAN NOT NULL DEFAULT true;
