-- Small new-game table only; cover its furniture reference.
create index island_placement_item on island_private.placements(item_id);
