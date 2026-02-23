/**
 * Checks if user has the required permission.
 * Matches backend _matches_permission logic: supports "*" and "resource:*".
 */
export function hasPermission(
  userPermissions: string[],
  required: string,
): boolean {
  if (userPermissions.includes("*")) return true;
  const [resource] = required.split(":");
  const wildcard = `${resource}:*`;
  return (
    userPermissions.includes(required) || userPermissions.includes(wildcard)
  );
}
