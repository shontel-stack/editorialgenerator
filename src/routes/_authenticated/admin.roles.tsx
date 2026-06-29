import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listAdmins,
  addAdminByEmail,
  removeAdmin,
  type AdminRow,
} from "@/lib/admin-roles.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: AdminRolesPage,
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AdminRolesPage() {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdmins();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      await addAdminByEmail({ data: { email: email.trim() } });
      toast.success(`${email.trim()} is now an admin.`);
      setEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add admin");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string, label: string) => {
    if (!confirm(`Remove admin access for ${label}?`)) return;
    setRemovingId(userId);
    try {
      await removeAdmin({ data: { userId } });
      toast.success(`Removed admin role from ${label}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove admin");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Admin roles</h1>
            <p className="text-sm text-muted-foreground">
              Grant or revoke admin access by email.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/signups">Signups</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="border border-destructive/50 bg-destructive/10 text-destructive rounded-md p-3 text-sm mb-4">
            {error === "Forbidden"
              ? "You don't have admin access to this page."
              : error}
          </div>
        )}

        <form
          onSubmit={handleAdd}
          className="flex gap-2 mb-6 border border-border rounded-lg bg-card p-4"
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            disabled={adding}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !email.trim()}>
            {adding ? "Adding…" : "Make admin"}
          </Button>
        </form>

        <div className="border border-border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead className="w-32 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={load}
                    disabled={loading}
                  >
                    {loading ? "…" : "Refresh"}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No admins yet.
                  </TableCell>
                </TableRow>
              )}
              {rows?.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.email ?? u.user_id}</TableCell>
                  <TableCell>{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removingId === u.user_id}
                      onClick={() => handleRemove(u.user_id, u.email ?? u.user_id)}
                    >
                      {removingId === u.user_id ? "Removing…" : "Remove"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows && !error && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
