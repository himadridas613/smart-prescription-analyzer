import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import {
  adminListAnnouncements,
  adminSaveAnnouncement,
  adminSetAnnouncementStatus,
  adminDeleteAnnouncement,
  adminListDeliveries,
  adminNotificationAudit,
  adminRetryDelivery,
} from "@/lib/admin-notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — MediScan AI admin" },
      { name: "description", content: "Create announcements and track in-app and email delivery." },
      { property: "og:title", content: "Notifications — MediScan AI admin" },
      { property: "og:description", content: "Announcements and delivery tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminNotifications,
});

type Audience = "all" | "user" | "doctor" | "pharmacist" | "admin";
type Kind = "info" | "warning" | "success";

function AdminNotifications() {
  const qc = useQueryClient();
  const listAnn = useServerFn(adminListAnnouncements);
  const save = useServerFn(adminSaveAnnouncement);
  const setStatus = useServerFn(adminSetAnnouncementStatus);
  const del = useServerFn(adminDeleteAnnouncement);
  const listDel = useServerFn(adminListDeliveries);
  const retry = useServerFn(adminRetryDelivery);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [type, setType] = useState<Kind>("info");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dSearch, setDSearch] = useState("");
  const [dStatus, setDStatus] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [dChannel, setDChannel] = useState<"all" | "in_app" | "email">("all");
  const [dRead, setDRead] = useState<"all" | "read" | "unread">("all");
  const listAudit = useServerFn(adminNotificationAudit);
  const audit = useQuery({ queryKey: ["admin-notif-audit"], queryFn: () => listAudit({ data: { limit: 50 } }), staleTime: 15_000 });

  const announcements = useQuery({ queryKey: ["admin-announcements"], queryFn: () => listAnn(), staleTime: 15_000 });
  const deliveries = useQuery({
    queryKey: ["admin-deliveries", dSearch, dStatus, dChannel, dRead],
    queryFn: () => listDel({ data: { search: dSearch, status: dStatus, channel: dChannel, read: dRead, page: 1, pageSize: 50 } }),
    staleTime: 15_000,
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: { id: editingId ?? undefined, title: title.trim(), body: body.trim(), audience, type } });
      toast.success(editingId ? "Announcement updated." : "Announcement saved as draft.");
      setEditingId(null);
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["admin-notif-audit"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string, status: "published" | "archived" | "draft") => {
    try {
      await setStatus({ data: { id, status } });
      toast.success(status === "published" ? "Announcement sent." : status === "draft" ? "Announcement unpublished." : "Announcement archived.");
      qc.invalidateQueries({ queryKey: ["admin-notif-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["admin-deliveries"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    }
  };

  const rows = deliveries.data?.rows ?? [];

  return (
    <AdminShell title="Notifications" description="Broadcast announcements and monitor delivery.">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Announcements" value={announcements.data?.length ?? 0} />
        <StatCard label="Deliveries" value={deliveries.data?.total ?? 0} />
        <StatCard label="Failed" value={rows.filter((r) => r.status === "failed").length} />
        <StatCard label="Unread" value={rows.filter((r) => !r.read).length} />
      </div>

      <form onSubmit={create} className="glass space-y-4 rounded-3xl p-5 shadow-card">
        <h2 className="text-sm font-semibold">{editingId ? "Edit announcement" : "New announcement"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input id="ann-title" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["all", "user", "doctor", "pharmacist", "admin"] as const).map((a) => (
                    <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["info", "warning", "success"] as const).map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ann-body">Message</Label>
          <Textarea id="ann-body" required minLength={3} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving} className="rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {editingId ? "Save changes" : "Save draft"}
        </Button>
        {editingId && (
          <Button type="button" variant="ghost" className="ml-2 rounded-xl" onClick={() => { setEditingId(null); setTitle(""); setBody(""); }}>
            Cancel
          </Button>
        )}
      </form>

      <section className="glass rounded-3xl p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Announcements</h2>
        {announcements.isLoading ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (announcements.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Title</th>
                  <th className="py-2">Audience</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(announcements.data ?? []).map((a) => (
                  <tr key={a.id} className="border-t border-border/60">
                    <td className="py-2 max-w-[260px] truncate">{a.title}</td>
                    <td className="py-2 capitalize">{a.audience}</td>
                    <td className="py-2 capitalize">{a.type}</td>
                    <td className="py-2 capitalize">{a.status}</td>
                    <td className="py-2">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => {
                          setEditingId(a.id); setTitle(a.title); setBody(a.body);
                          setAudience(a.audience as Audience); setType(a.type as Kind);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>Edit</Button>
                        {a.status === "published" && (
                          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => publish(a.id, "draft")}>
                            Unpublish
                          </Button>
                        )}
                        {a.status !== "published" && (
                          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => publish(a.id, "published")}>
                            <Send className="mr-1 h-3.5 w-3.5" /> Send
                          </Button>
                        )}
                        {a.status !== "archived" && (
                          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => publish(a.id, "archived")}>
                            Archive
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg text-destructive"
                          onClick={async () => {
                            if (!confirm("Delete this announcement?")) return;
                            await del({ data: { id: a.id } }).catch(() => toast.error("Delete failed."));
                            qc.invalidateQueries({ queryKey: ["admin-announcements"] });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass rounded-3xl p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Delivery tracking</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-4">
          <Input placeholder="Search recipient…" value={dSearch} onChange={(e) => setDSearch(e.target.value)} />
          <Select value={dStatus} onValueChange={(v) => setDStatus(v as typeof dStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["all", "sent", "pending", "failed"] as const).map((v) => <SelectItem key={v} value={v} className="capitalize">{v === "all" ? "All statuses" : v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={dChannel} onValueChange={(v) => setDChannel(v as typeof dChannel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["all", "in_app", "email"] as const).map((v) => <SelectItem key={v} value={v}>{v === "all" ? "All channels" : v === "in_app" ? "In-app" : "Email"}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={dRead} onValueChange={(v) => setDRead(v as typeof dRead)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["all", "read", "unread"] as const).map((v) => <SelectItem key={v} value={v} className="capitalize">{v === "all" ? "Read & unread" : v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {deliveries.isLoading ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Recipient</th>
                  <th className="py-2">Channel</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Read</th>
                  <th className="py-2">Retries</th>
                  <th className="py-2">When</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-border/60">
                    <td className="py-2">{d.recipient_email ?? "—"}</td>
                    <td className="py-2">{d.channel}</td>
                    <td className="py-2 capitalize">{d.status}</td>
                    <td className="py-2">{d.read ? "Yes" : "No"}</td>
                    <td className="py-2">{d.retry_count ?? 0}</td>
                    <td className="py-2">{new Date(d.created_at).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      {d.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={async () => {
                            try {
                              await retry({ data: { id: d.id } });
                              toast.success("Delivery retried.");
                              qc.invalidateQueries({ queryKey: ["admin-deliveries"] });
                            } catch {
                              toast.error("Retry failed.");
                            }
                          }}
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="glass rounded-3xl p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Audit history</h2>
        {audit.isLoading ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (audit.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No notification actions recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(audit.data ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                <span><span className="font-medium">{l.action.replace(/_/g, " ")}</span> <span className="text-muted-foreground">by {l.admin_email ?? "admin"}</span></span>
                <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
