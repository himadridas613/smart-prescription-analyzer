import { createFileRoute } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { RoleDirectory } from "@/components/admin/RoleDirectory";

export const Route = createFileRoute("/admin/doctors")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Doctors — MediScan AI admin" },
      { name: "description", content: "Manage doctor accounts, verification and access in MediScan AI." },
      { property: "og:title", content: "Doctors — MediScan AI admin" },
      { property: "og:description", content: "Manage doctor accounts and access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleDirectory
      role="doctor"
      title="Doctors"
      description="Verified clinicians who can review prescription analyses."
      icon={Stethoscope}
    />
  ),
});
