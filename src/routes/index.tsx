import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/components/studio/home";

export const Route = createFileRoute("/")({ component: Home });
