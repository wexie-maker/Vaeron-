import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/components/studio/shell";

export const Route = createFileRoute("/studio/$projectId")({
  component: StudioRoute,
});

function StudioRoute() {
  const { projectId } = Route.useParams();
  return <StudioShell projectId={projectId} />;
}
