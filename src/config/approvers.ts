// Demo allowlist. The production implementation will call Microsoft Graph
// (/me/memberOf or /me/checkMemberGroups) to verify membership in the
// SoftwareRequest-Approvers Entra group. See lib/role.ts.
export const APPROVER_UPNS: readonly string[] = [
  "hetnon@hetnonfreitas.onmicrosoft.com",
];

export const APPROVER_GROUP_NAME = "SoftwareRequest-Approvers";
