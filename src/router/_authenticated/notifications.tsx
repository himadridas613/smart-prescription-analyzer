import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MediScan AI" },
      { name: "description", content: "Analysis updates, sharing activity and security alerts for your MediScan AI account." },
      { property: "og:title", content: "Notifications — MediScan AI" },
      { property: "og:description", content: "Your MediScan AI notification center." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchAll(),
  });

  const readAll = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = items.filter(n => !n.read).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Notifications</h1>
          <p className="mt-1 text-muted-foreground">{unread} unread of {items.length}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" className="rounded-full" onClick={() => readAll.mutate()}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="glass overflow-hidden rounded-3xl shadow-card">
        {isLoading && <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <div className="p-12 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </div>
        )}
        {items.map(n => (
          <button key={n.id} onClick={() => !n.read && readOne.mutate(n.id)}
            className={`block w-full border-b border-border/60 p-4 text-left transition hover:bg-secondary/60 ${n.read ? "" : "bg-primary/5"}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                n.type === "error" ? "bg-destructive" : n.type === "success" ? "bg-emerald-500" : "bg-primary"
              }`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
