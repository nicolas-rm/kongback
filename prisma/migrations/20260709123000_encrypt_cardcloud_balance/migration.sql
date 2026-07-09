ALTER TABLE "cardcloud_card_stock"
    ALTER COLUMN "balance" TYPE TEXT USING "balance"::text;
