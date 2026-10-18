/**
 * Admin access: the users.is_admin column, or an email listed in ADMIN_EMAILS (comma separated).
 */
export function isAdminUser(user: { email: string; isAdmin: boolean }): boolean {
  if (user.isAdmin) return true;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}
