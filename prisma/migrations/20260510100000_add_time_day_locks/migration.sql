CREATE TABLE "TimeDayLock" (
  "id" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT true,
  "lockedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TimeDayLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimeDayLock_dateKey_key" ON "TimeDayLock"("dateKey");

ALTER TABLE "TimeDayLock"
  ADD CONSTRAINT "TimeDayLock_lockedById_fkey"
  FOREIGN KEY ("lockedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
