import { createFileRoute } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { RoleDirectory } from "@/components/admin/RoleDirectory";

export const Route = createFileRoute("/admin/pharmacists")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pharmacists — MediScan AI admin" },
      { name: "description", content: "Manage pharmacist accounts, verification and access in MediScan AI." },
      { property: "og:title", content: "Pharmacists — MediScan AI admin" },
      { property: "og:description", content: "Manage pharmacist accounts and access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleDirectory
      role="pharmacist"
      title="Pharmacists"
      description="Dispensing professionals who verify medicine safety."
      icon={Pill}
    />
  ),
});
