-- Drop Cardcloud stock fields that are outside the MVP scope.
ALTER TABLE "cardcloud_card_stock"
    DROP COLUMN "brand",
    DROP COLUMN "clabe",
    DROP COLUMN "metadata";
