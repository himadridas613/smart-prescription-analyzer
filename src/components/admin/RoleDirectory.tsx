import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Download, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminGetUsers, adminSetUserActive } from "@/lib/admin-users.functions";
import { exportCsv } from "@/lib/admin-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "doctor" | "pharmacist";

/** Shared directory used by the Doctors and Pharmacists admin pages. */
export function RoleDirectory({
  role,
  title,
  description,
  icon,
}: {
  role: Role;
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(adminGetUsers);
  const setActive = useServerFn(adminSetUserActive);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-role-directory", role, search, page],
    queryFn: () => fetchUsers({ data: { search, role, status: "all", sort: "newest", page, pageSize: 20 } }),
    staleTime: 15_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const active = rows.filter((r) => r.is_active).length;

  const toggle = async (userId: string, next: boolean) => {
    try {
      await setActive({ data: { userId, active: next } });
      toast.success(next ? "Account activated." : "Account deactivated.");
      qc.invalidateQueries({ queryKey: ["admin-role-directory"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  return (
    <AdminShell
      title={title}
      description={description}
      actions={
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => exportCsv(`${role}s`, rows as unknown as Array<Record<string, unknown>>)}
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Total ${role}s`} value={total} icon={icon} />
        <StatCard label="Active (page)" value={active} />
        <StatCard label="Uploads (page)" value={rows.reduce((a, b) => a + b.uploads, 0)} />
      </div>

      <div className="glass rounded-3xl p-4 shadow-card">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {isLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No {role}s found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Verified</th>
                  <th className="py-2">Uploads</th>
                  <th className="py-2">Last login</th>
                  <th className="py-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="py-2">{u.full_name ?? "—"}</td>
                    <td className="py-2">{u.email ?? "—"}</td>
                    <td className="py-2">{u.verified ? "Yes" : "No"}</td>
                    <td className="py-2">{u.uploads}</td>
                    <td className="py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
                    <td className="py-2">
                      <span
                        className={
                          u.is_active
                            ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                        }
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => toggle(u.id, !u.is_active)}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} · {total} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}