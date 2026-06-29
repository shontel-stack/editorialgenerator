import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listSignups, type SignupRow } from "@/lib/admin-users.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/signups")({
  component: AdminSignupsPage,
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AdminSignupsPage() {
  const [rows, setRows] = useState<SignupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSignups();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Signups</h1>
            <p className="text-sm text-muted-foreground">
              New user accounts, newest first.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/">Back</Link>
            </Button>
            <Button onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
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

        <div className="border border-border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Last sign in</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No signups yet.
                  </TableCell>
                </TableRow>
              )}
              {rows?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                  <TableCell>{formatDate(u.created_at)}</TableCell>
                  <TableCell>{formatDate(u.last_sign_in_at)}</TableCell>
                  <TableCell>{u.provider ?? "—"}</TableCell>
                  <TableCell>{u.confirmed_at ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
              {!rows && !error && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
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
