-- Run AFTER wiping the database and signing up again in the new BlueBelly app.
-- 1) Sign up the official account with any free username (e.g. "bluebelly_official") using the official email,
--    and verify its email.
-- 2) Then run the three lines below (adjust the two emails if they differ):

UPDATE users
   SET username = 'bluebelly', name = 'BlueBelly', is_official = true, verified = true
 WHERE email = 'grieezboy@gmail.com';

UPDATE users SET is_admin = true WHERE email = 'muhammadjamiuyusuf876@gmail.com';

-- (If the official account and your admin account are the same login, run only the first line plus:
--  UPDATE users SET is_admin = true WHERE email = 'grieezboy@gmail.com';)
