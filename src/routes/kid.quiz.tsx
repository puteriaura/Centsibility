import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kid/quiz")({
  beforeLoad: () => {
    throw redirect({
      to: "/kid/missions",
    });
  },
  component: () => null,
});
