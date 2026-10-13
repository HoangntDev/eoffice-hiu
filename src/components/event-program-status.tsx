import styles from "./event-programs.module.css";
import { statusLabels, type EventProgramStatus } from "@/modules/event-programs/schemas";

export function EventProgramStatusBadge({ status }: { status: string }) {
  const known = status in statusLabels ? (status as EventProgramStatus) : null;
  return (
    <span className={`status ${known ? styles[`status_${known}`] : ""}`}>
      {known ? statusLabels[known] : status}
    </span>
  );
}
