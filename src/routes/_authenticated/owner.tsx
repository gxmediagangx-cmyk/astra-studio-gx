import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, ShieldCheck, Copy, RotateCcw, Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import {
  ownerListUsers, ownerToggleUser, ownerListCodes, ownerCreateCodes,
  ownerRevokeCode, ownerReactivateCode, ownerDeleteCode, ownerDeleteUser, ownerAuditLogs,
} from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({ meta: [{ title: "Owner — ASTRA STUDIO" }] }),
  component: OwnerPage,
});

function OwnerPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listUsersFn = useServerFn(ownerListUsers);
  const toggleUserFn = useServerFn(ownerToggleUser);
  const deleteUserFn = useServerFn(ownerDeleteUser);
  const listCodesFn = useServerFn(ownerListCodes);
  const createCodesFn = useServerFn(ownerCreateCodes);
  const revokeCodeFn = useServerFn(ownerRevokeCode);
  const reactivateCodeFn = useServerFn(ownerReactivateCode);
  const deleteCodeFn = useServerFn(ownerDeleteCode);
  const logsFn = useServerFn(ownerAuditLogs);

  const users = useQuery({ queryKey: ["owner-users"], queryFn: () => listUsersFn() });
  const codes = useQuery({ queryKey: ["owner-codes"], queryFn: () => listCodesFn() });
  const logs = useQuery({ queryKey: ["owner-logs"], queryFn: () => logsFn() });

  if (users.data && !users.data.ok) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Access denied</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{users.data.error}</p>
            <Button onClick={() => navigate({ to: "/dashboard" })}>Go to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [newCount, setNewCount] = useState(5);
  const [newNotes, setNewNotes] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdBatch, setCreatedBatch] = useState<string[]>([]);

  const generate = async () => {
    const res = await createCodesFn({ data: { count: newCount, notes: newNotes || undefined } });
    if (!res.ok) return toast.error(res.error);
    setCreatedBatch(res.codes);
    qc.invalidateQueries({ queryKey: ["owner-codes"] });
    toast.success(`Generated ${res.codes.length} codes`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="size-4" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground font-bold">A</div>
              <div className="leading-tight">
                <div className="font-bold tracking-tight">Owner Console</div>
                <div className="text-xs text-muted-foreground">ASTRA STUDIO · GX Team</div>
              </div>
            </Link>
          </div>
          <LanguageToggle /><ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="codes">
          <TabsList>
            <TabsTrigger value="codes">Activation codes</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="logs">Audit logs</TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Activation codes</CardTitle>
                <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedBatch([]); }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="size-4" /> Generate codes</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Generate activation codes</DialogTitle></DialogHeader>
                    {createdBatch.length === 0 ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm">How many?</label>
                          <Input type="number" min={1} max={100} value={newCount}
                            onChange={(e) => setNewCount(Math.max(1, Math.min(100, Number(e.target.value))))} />
                        </div>
                        <div>
                          <label className="text-sm">Notes (optional)</label>
                          <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="e.g. Batch March 2026" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Copy these codes now. They will not be shown again grouped like this.</p>
                        <pre className="bg-muted p-3 rounded text-xs max-h-64 overflow-auto">{createdBatch.join("\n")}</pre>
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdBatch.join("\n")); toast.success("Copied"); }}>
                          <Copy className="size-3" /> Copy all
                        </Button>
                      </div>
                    )}
                    <DialogFooter>
                      {createdBatch.length === 0 ? (
                        <Button onClick={generate}>Generate</Button>
                      ) : (
                        <Button onClick={() => { setCreateOpen(false); setCreatedBatch([]); }}>Done</Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead>
                    <TableHead>Created</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {codes.data?.ok && codes.data.codes.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.code}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "unused" ? "default" : c.status === "used" ? "secondary" : "destructive"}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{c.notes ?? "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {c.status !== "revoked" ? (
                              <Button size="sm" variant="ghost" title="Disable code"
                                onClick={async () => {
                                  const r = await revokeCodeFn({ data: { id: c.id } });
                                  if (r.ok) {
                                    qc.invalidateQueries({ queryKey: ["owner-codes"] });
                                    qc.invalidateQueries({ queryKey: ["owner-users"] });
                                    qc.invalidateQueries({ queryKey: ["owner-logs"] });
                                    toast.success("Code disabled");
                                  } else toast.error(r.error);
                                }}><Ban className="size-3" /></Button>
                            ) : (
                              <Button size="sm" variant="ghost" title="Re-activate code"
                                onClick={async () => {
                                  const r = await reactivateCodeFn({ data: { id: c.id } });
                                  if (r.ok) {
                                    qc.invalidateQueries({ queryKey: ["owner-codes"] });
                                    qc.invalidateQueries({ queryKey: ["owner-users"] });
                                    qc.invalidateQueries({ queryKey: ["owner-logs"] });
                                    toast.success("Code re-activated");
                                  } else toast.error(r.error);
                                }}><RotateCcw className="size-3" /></Button>
                            )}
                            <Button size="sm" variant="ghost" title="Delete code"
                              onClick={async () => {
                                if (!confirm("Permanently delete this code? This cannot be undone.")) return;
                                const r = await deleteCodeFn({ data: { id: c.id } });
                                if (r.ok) {
                                  qc.invalidateQueries({ queryKey: ["owner-codes"] });
                                  qc.invalidateQueries({ queryKey: ["owner-logs"] });
                                  toast.success("Code deleted");
                                } else toast.error(r.error);
                              }}><Trash2 className="size-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Users</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Email</TableHead><TableHead>Name</TableHead>
                    <TableHead>Code</TableHead><TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.data?.ok && users.data.users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="text-xs">{u.email}</TableCell>
                        <TableCell className="text-xs">{u.display_name ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {u.activation_code ?? "—"}
                          {u.code_status === "revoked" && (
                            <Badge variant="destructive" className="ml-2">disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "active" : "disabled"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={async () => {
                              const r = await toggleUserFn({ data: { userId: u.id, isActive: !u.is_active } });
                              if (r.ok) {
                                qc.invalidateQueries({ queryKey: ["owner-users"] });
                                qc.invalidateQueries({ queryKey: ["owner-logs"] });
                                toast.success("Updated");
                              } else toast.error(r.error);
                            }}>{u.is_active ? "Disable" : "Enable"}</Button>
                            <Button size="sm" variant="destructive" onClick={async () => {
                              if (!confirm(`Permanently delete ${u.email}? All their projects will be removed.`)) return;
                              const r = await deleteUserFn({ data: { userId: u.id } });
                              if (r.ok) {
                                qc.invalidateQueries({ queryKey: ["owner-users"] });
                                qc.invalidateQueries({ queryKey: ["owner-codes"] });
                                qc.invalidateQueries({ queryKey: ["owner-logs"] });
                                toast.success("User deleted");
                              } else toast.error(r.error);
                            }}><Trash2 className="size-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Audit logs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>When</TableHead><TableHead>Action</TableHead>
                    <TableHead>Target</TableHead><TableHead>Actor</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {logs.data?.ok && logs.data.logs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-mono">{l.action}</TableCell>
                        <TableCell className="text-xs">
                          {l.target_user ? (
                            <div className={l.target_user.missing ? "italic text-muted-foreground" : ""}>
                              <div>{l.target_user.label}</div>
                              {l.target_user.sublabel && (
                                <div className="text-[10px] text-muted-foreground">{l.target_user.sublabel}</div>
                              )}
                            </div>
                          ) : l.target_type ? (
                            <span className="text-muted-foreground">{l.target_type}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.actor ? (
                            <div className={l.actor.missing ? "italic text-muted-foreground" : ""}>
                              <div>{l.actor.label}</div>
                              {l.actor.sublabel && (
                                <div className="text-[10px] text-muted-foreground">{l.actor.sublabel}</div>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
