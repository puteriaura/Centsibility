import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kid/zakat")({
  beforeLoad: () => {
    throw redirect({
      to: "/kid/sadaqah",
      search: { tab: "zakat" },
    });
  },
  component: () => null,
});
