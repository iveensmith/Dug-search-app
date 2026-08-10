-- Patients search by the brand name on the box, and pharmacies record that
-- brand per stocked item ("Aquaclav" for Amoxicillin/Clavulanate 625mg).
-- Until now only Drug.brandNames was searchable, so a brand a pharmacy had
-- actually registered came back as "No drug matching ... is in our list
-- yet" — while sitting in that pharmacy's inventory.
--
-- /api/drugs/search now matches PharmacyInventory.brand as well, which is
-- another ILIKE '%q%' on every keystroke. A leading wildcard cannot use a
-- btree, so without this index the autocomplete would scan every inventory
-- row in the country each time somebody types a letter.
--
-- Same shape as the two Drug trigram indexes in 20260807090000, and the
-- extension is already installed by that migration.
CREATE INDEX "PharmacyInventory_brand_trgm_idx"
  ON "PharmacyInventory" USING gin ("brand" gin_trgm_ops);
