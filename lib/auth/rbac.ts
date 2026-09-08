/**
 * Pure utility to evaluate access based on permission keys.
 *
 * Never hard-code roles in feature code — evaluate permission keys only.
 * Example: `hasPermission("calendar.view", userPermissions)`.
 *
 * @param requiredPermission - The permission key required (e.g., "calendar.view").
 * @param userPermissions - The array of permission keys the current user holds.
 * @returns `true` if the user holds the required permission.
 */
export function hasPermission(
  requiredPermission: string,
  userPermissions: string[]
): boolean {
  if (!requiredPermission || userPermissions.length === 0) return false;
  return userPermissions.includes(requiredPermission);
}
