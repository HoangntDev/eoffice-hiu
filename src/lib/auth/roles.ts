// Nhóm vai trò dùng để quyết định menu và quyền mở trang quản trị.
// Quyền thật vẫn do RPC/RLS kiểm tra; đây chỉ để không hiện chức năng người dùng không dùng được.

export const ORGANIZATION_ROLES = ["school_admin", "faculty_manager", "faculty_executive", "committee_manager"] as const;
export const MEMBERSHIP_REVIEW_ROLES = ["school_admin", "office", "collaborator"] as const;

export type NavAccess = {
  organization: boolean;
  membershipReview: boolean;
};

export function navAccess(roles: readonly string[]): NavAccess {
  return {
    organization: roles.some((role) => (ORGANIZATION_ROLES as readonly string[]).includes(role)),
    membershipReview: roles.some((role) => (MEMBERSHIP_REVIEW_ROLES as readonly string[]).includes(role)),
  };
}
