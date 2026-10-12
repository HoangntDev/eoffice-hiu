import type { EventProgramStatus } from "./schemas";

// UI hint only: every action is re-checked by the RPC and RLS on the server.
export function availableActions(
  status: EventProgramStatus,
  viewer: { isManager: boolean; isReviewer: boolean; hasSubmitted: boolean },
) {
  const editable = status === "draft" || status === "needs_changes";
  return {
    canEdit: viewer.isManager && editable,
    canSubmit: viewer.isManager && editable,
    canReview: viewer.isReviewer && status === "submitted" && !viewer.hasSubmitted,
  };
}
