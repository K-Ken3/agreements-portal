CREATE TYPE "AgreementSignerRole" AS ENUM ('ISSUER', 'COUNTERPARTY');

CREATE TABLE "agreement_signers" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "role" "AgreementSignerRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitation_token_hash" TEXT,
    "invitation_expires_at" TIMESTAMP(3),
    "invitation_sent_at" TIMESTAMP(3),
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_sent_at" TIMESTAMP(3),
    "otp_send_count" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "session_token_hash" TEXT,
    "session_expires_at" TIMESTAMP(3),
    "signed_name" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_content_hash" TEXT,

    CONSTRAINT "agreement_signers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agreement_signers_invitation_token_hash_key"
    ON "agreement_signers"("invitation_token_hash");
CREATE UNIQUE INDEX "agreement_signers_session_token_hash_key"
    ON "agreement_signers"("session_token_hash");
CREATE UNIQUE INDEX "agreement_signers_agreement_id_role_key"
    ON "agreement_signers"("agreement_id", "role");
CREATE INDEX "agreement_signers_agreement_id_signed_at_idx"
    ON "agreement_signers"("agreement_id", "signed_at");

ALTER TABLE "agreement_signers"
    ADD CONSTRAINT "agreement_signers_agreement_id_fkey"
    FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
