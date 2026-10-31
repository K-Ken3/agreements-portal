-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'INVITED', 'RECIPIENT_ACCESSED', 'DETAILS_PENDING', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'LOCKED_FOR_SIGNING', 'PARTIALLY_SIGNED', 'FINALIZING', 'FINALIZED', 'EXPIRED', 'CANCELLED', 'DISPUTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "public_reference" TEXT NOT NULL,
    "issuer_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "effective_date" DATE,
    "signing_deadline" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_versions" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "canonical_content_json" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "canonicalization" TEXT NOT NULL DEFAULT 'json-c14n-v1',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),

    CONSTRAINT "agreement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_events" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "event_payload_minimized" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_event_hash" TEXT,
    "event_hash" TEXT NOT NULL,

    CONSTRAINT "agreement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "agreements_public_reference_key" ON "agreements"("public_reference");

-- CreateIndex
CREATE INDEX "agreements_issuer_user_id_updated_at_idx" ON "agreements"("issuer_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "agreements_status_updated_at_idx" ON "agreements"("status", "updated_at");

-- CreateIndex
CREATE INDEX "agreement_versions_agreement_id_created_at_idx" ON "agreement_versions"("agreement_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_versions_agreement_id_version_number_key" ON "agreement_versions"("agreement_id", "version_number");

-- CreateIndex
CREATE INDEX "agreement_events_agreement_id_occurred_at_idx" ON "agreement_events"("agreement_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_issuer_user_id_fkey" FOREIGN KEY ("issuer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_events" ADD CONSTRAINT "agreement_events_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_events" ADD CONSTRAINT "agreement_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
