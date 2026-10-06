-- A square table (features/seating: shape 'square', seats on all four sides) beside the rectangular
-- one ('rect', seats along its long sides) — "מרובע" was a rectangle with eight seats.
alter table public.seating_tables drop constraint seating_tables_shape_check;
alter table public.seating_tables
  add constraint seating_tables_shape_check check (shape in ('round', 'square', 'rect', 'knights'));
