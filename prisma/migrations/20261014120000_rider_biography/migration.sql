-- CreateTable
CREATE TABLE "rider_biographies" (
    "id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_biographies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rider_biographies_rider_id_language_key" ON "rider_biographies"("rider_id", "language");

-- AddForeignKey
ALTER TABLE "rider_biographies" ADD CONSTRAINT "rider_biographies_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

