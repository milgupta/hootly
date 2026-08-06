-- Migration 0003 — exam integrity at the column level (docs/04 §4, docs/05 §7.5).
--
-- Doc 04 §4 states: "full quiz_questions reads go through a server action that
-- checks the attempt is completed". The Class B "own read" policy alone still lets
-- a signed-in client select quiz_questions.answer/explanation directly with the
-- anon key, which would defeat the exam-realism rule. Column grants close that:
-- clients keep exactly the quiz_questions_take columns, everything else is
-- service-role only (server actions read answers with the admin client).

revoke select on quiz_questions from authenticated, anon;
grant select (id, quiz_id, user_id, idx, qtype, topic, prompt, options, difficulty)
  on quiz_questions to authenticated;

-- The take view is security_invoker, so it reads through the grants above.
grant select on quiz_questions_take to authenticated;
