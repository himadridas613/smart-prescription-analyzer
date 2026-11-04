import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2, Search, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminChangeUserRole, adminDeleteUser, adminGetUserDetail, adminGetUsers, adminSetUserActive, adminUpdateUserProfile,
} from "@/lib/admin-users.functions";
import { exportCsv, exportPdf } from "@/lib/admin-export";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "User management — MediScan AI admin" },
      { name: "description", content: "Search, review and manage every MediScan AI account and role." },
      { property: "og:title", content: "User management — MediScan AI admin" },
      { property: "og:description", content: "Manage accounts, roles and access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsersPage,
});

const ROLES = ["user", "doctor", "pharmacist", "admin"] as const;
type Role = (typeof ROLES)[number];

function AdminUsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminGetUsers);
  const detail = useServerFn(adminGetUserDetail);
  const changeRole = useServerFn(adminChangeUserRole);
  const setActive = useServerFn(adminSetUserActive);
  const updateProfile = useServerFn(adminUpdateUserProfile);
  const removeUser = useServerFn(adminDeleteUser);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users", search, role, status, sort, page],
    queryFn: () => list({ data: { search, role, status, sort, page, pageSize: 20 } }),
    staleTime: 15_000,
  });

  const { data: userDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-user", openUser],
    queryFn: () => detail({ data: { userId: openUser! } }),
    enabled: Boolean(openUser),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-user"] });
  };
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Action failed.");

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => changeRole({ data: v }),
    onSuccess: () => { toast.success("Role updated."); refresh(); },
    onError,
  });
  const activeMutation = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setActive({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.active ? "Account activated." : "Account deactivated."); refresh(); },
    onError,
  });
  const profileMutation = useMutation({
    mutationFn: (v: { userId: string; fullName: string | null }) => updateProfile({ data: v }),
    onSuccess: () => { toast.success("Profile updated."); refresh(); },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted."); setConfirmDelete(null); setOpenUser(null); refresh(); },
    onError,
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const exportRows = rows.map((u) => ({
    name: u.full_name ?? "",
    email: u.email ?? "",
    roles: u.roles.join(" / "),
    verified: u.verified ? "yes" : "no",
    active: u.is_active ? "yes" : "no",
    uploads: u.uploads,
    last_login: u.last_login_at ?? "",
    created_at: u.created_at,
  }));

  return (
    <AdminShell title="User management" description="Every account, role and access state on the platform.">
      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4 shadow-card">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, email or role"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={(v) => { setRole(v as typeof role); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => exportCsv("users", exportRows)}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => exportPdf("MediScan AI — Users", exportRows)}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <section className="glass overflow-hidden rounded-3xl p-2 shadow-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : isError ? (
          <p className="p-8 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load users."}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No users match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Verified</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Uploads</th>
                  <th className="p-3">Last login</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="p-3">
                      <p className="font-medium">{u.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="p-3">
                      <Select
                        value={(u.roles[0] ?? "user") as Role}
                        onValueChange={(v) => roleMutation.mutate({ userId: u.id, role: v as Role })}
                      >
                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Badge variant={u.verified ? "default" : "secondary"}>{u.verified ? "Verified" : "Pending"}</Badge>
                    </td>
                    <td className="p-3">
                      <Switch checked={u.is_active}
                        onCheckedChange={(c) => activeMutation.mutate({ userId: u.id, active: c })} />
                    </td>
                    <td className="p-3">{u.uploads}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="rounded-lg"
                          onClick={() => { setOpenUser(u.id); setEditName(u.full_name ?? ""); }}>
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-lg text-destructive"
                          onClick={() => setConfirmDelete(u.id)}>
                          <Trash2 className="h-4 w-4" />
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

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} users · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={Boolean(openUser)} onOpenChange={(o) => !o && setOpenUser(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>User profile</DialogTitle>
            <DialogDescription>Review activity and edit account details.</DialogDescription>
          </DialogHeader>
          {detailLoading || !userDetail ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-accent/40 p-3 text-xs">
                <div><dt className="text-muted-foreground">Email</dt><dd>{userDetail.profile.email ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Provider</dt><dd>{String(userDetail.provider)}</dd></div>
                <div><dt className="text-muted-foreground">Roles</dt><dd>{userDetail.roles.join(", ") || "user"}</dd></div>
                <div><dt className="text-muted-foreground">Verified</dt><dd>{userDetail.verified ? "Yes" : "No"}</dd></div>
                <div><dt className="text-muted-foreground">Last login</dt>
                  <dd>{userDetail.lastSignInAt ? new Date(userDetail.lastSignInAt).toLocaleString() : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Created</dt>
                  <dd>{new Date(userDetail.profile.created_at).toLocaleDateString()}</dd></div>
              </dl>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent uploads</p>
                {userDetail.recentUploads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No uploads yet.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {userDetail.recentUploads.map((u) => (
                      <li key={u.id} className="flex justify-between gap-2">
                        <span className="truncate">{u.file_name ?? u.id.slice(0, 8)}</span>
                        <span className="text-muted-foreground">{u.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent activity</p>
                {userDetail.recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recorded activity.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {userDetail.recentActivity.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span>{a.action}</span>
                        <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpenUser(null)}>Close</Button>
            <Button
              className="rounded-xl gradient-hero text-primary-foreground border-0"
              disabled={profileMutation.isPending || !openUser}
              onClick={() => profileMutation.mutate({ userId: openUser!, fullName: editName.trim() || null })}
            >
              {profileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account, its prescriptions, reports and stored files. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
