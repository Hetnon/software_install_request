import type { SdkUser } from "./sdk";
import { APPROVER_UPNS } from "../config/approvers";

export type Role = "approver" | "requester";

// Demo body: hardcoded UPN allowlist. Swap in a Graph call to
// /me/memberOf and check for APPROVER_GROUP_NAME when token plumbing
// is wired up. Signature stays the same so callers don't change.
export async function getRoleForUser(user: SdkUser): Promise<Role> {
  const upn = user.userPrincipalName?.toLowerCase();
  if (upn && APPROVER_UPNS.some((a) => a.toLowerCase() === upn)) {
    return "approver";
  }
  return "requester";
}
