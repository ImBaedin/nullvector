import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui-mockups")({
  component: UiMockupsLayoutRoute,
});

function UiMockupsLayoutRoute() {
  return <Outlet />;
}
