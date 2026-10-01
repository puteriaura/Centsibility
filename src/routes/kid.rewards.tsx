import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kid/rewards")({
  beforeLoad: () => {
    throw redirect({
      to: "/kid/missions",
      search: { tab: "rewards" },
    });
  },
  component: () => null,
});
