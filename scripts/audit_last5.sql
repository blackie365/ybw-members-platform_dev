SELECT
  id,
  action,
  substr(COALESCE(note, ''), 1, 120) AS note_short,
  operator,
  created_at::text AS created
FROM member_audit
ORDER BY id DESC
LIMIT 5;
