ALTER TABLE "Client" ADD COLUMN "email" TEXT;
ALTER TABLE "Client" ADD COLUMN "phone" TEXT;

UPDATE "Client"
SET "email" = "contact"
WHERE "contact" IS NOT NULL AND "contact" LIKE '%@%';

UPDATE "Client"
SET "phone" = "contact"
WHERE "contact" IS NOT NULL AND "contact" NOT LIKE '%@%';
