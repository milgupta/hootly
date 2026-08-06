-- Migration 0002 — columns required by screens but absent from doc 04's schema
-- (each logged in DECISIONS.md; doc 04 remains the priority source on conflict).

-- Privacy tab (docs/05 §8): marketing email toggle, default OFF (trust position).
alter table profiles add column marketing_emails boolean default false;
grant update (marketing_emails) on profiles to authenticated;

-- Plan roll-forward (docs/04 §6, 05 §7.7): "moved from {day}" annotation needs a home.
alter table study_plan_items add column moved_from date;
