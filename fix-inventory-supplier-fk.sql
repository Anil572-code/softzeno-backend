ALTER TABLE "InventoryItem"
DROP CONSTRAINT IF EXISTS "InventoryItem_supplierId_fkey";

ALTER TABLE "InventoryStockBatch"
DROP CONSTRAINT IF EXISTS "InventoryStockBatch_supplierId_fkey";

ALTER TABLE "InventoryStockMovement"
DROP CONSTRAINT IF EXISTS "InventoryStockMovement_supplierId_fkey";

UPDATE "InventoryItem"
SET "supplierId" = NULL
WHERE "supplierId" IS NOT NULL
AND "supplierId" NOT IN (
  SELECT "id" FROM "LedgerAccount" WHERE "type" = 'Supplier'
);

UPDATE "InventoryStockBatch"
SET "supplierId" = NULL
WHERE "supplierId" IS NOT NULL
AND "supplierId" NOT IN (
  SELECT "id" FROM "LedgerAccount" WHERE "type" = 'Supplier'
);

UPDATE "InventoryStockMovement"
SET "supplierId" = NULL
WHERE "supplierId" IS NOT NULL
AND "supplierId" NOT IN (
  SELECT "id" FROM "LedgerAccount" WHERE "type" = 'Supplier'
);

ALTER TABLE "InventoryItem"
ADD CONSTRAINT "InventoryItem_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "LedgerAccount"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "InventoryStockBatch"
ADD CONSTRAINT "InventoryStockBatch_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "LedgerAccount"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "InventoryStockMovement"
ADD CONSTRAINT "InventoryStockMovement_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "LedgerAccount"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;