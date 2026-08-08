"use client";

import { ArrowLeft, CircleAlert, QrCode, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  createDiningTableAction,
  rotateDiningTableQrAction,
  setDiningTableActiveAction,
} from "@/app/admin/dining-table-actions";
import { PrintableTableQr } from "@/components/dining-tables/printable-table-qr";
import { TableQrCode, buildTableQrUrl } from "@/components/dining-tables/table-qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format/currency";
import type { DiningTableListItem, DiningTableQrCredential, TableOperationalState } from "@/types/dining-tables";

type AdminTablesRole = "owner" | "admin";

const STATUS_LABEL: Record<TableOperationalState, string> = {
  free: "Libre",
  open_account: "Cuenta abierta",
  inactive: "Inactiva",
};

const STATUS_BADGE: Record<TableOperationalState, "success" | "warning" | "muted"> = {
  free: "success",
  open_account: "warning",
  inactive: "muted",
};

export function DiningTablesAdminScreen({
  tables,
  loadError,
  role,
  branchOptions,
}: {
  tables: DiningTableListItem[];
  loadError: string | null;
  role: AdminTablesRole;
  branchOptions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState(branchOptions[0]?.id ?? "");
  const [credential, setCredential] = useState<DiningTableQrCredential | null>(null);
  const [credentialName, setCredentialName] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<DiningTableListItem | null>(null);

  const pendingTableIdRef = useRef<string | null>(null);

  function showCredential(data: DiningTableQrCredential, nameHint?: string | null) {
    setCredential(data);
    setCredentialName(
      nameHint?.trim() ||
        tables.find((table) => table.tableId === data.tableId)?.name ||
        null,
    );
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!branchId) {
      toast({ title: "Elige una sucursal", variant: "error" });
      return;
    }
    startTransition(async () => {
      const result = await createDiningTableAction({
        branchId,
        code: code.trim(),
        name: name.trim() || null,
      });
      if (!result.ok) {
        toast({ title: "No se pudo crear la mesa", description: result.message, variant: "error" });
        return;
      }
      toast({ title: "Mesa creada", variant: "success" });
      setCode("");
      setName("");
      showCredential(result.data, name.trim() || null);
      router.refresh();
    });
  }

  function handleSetActive(table: DiningTableListItem, isActive: boolean) {
    pendingTableIdRef.current = table.tableId;
    startTransition(async () => {
      const result = await setDiningTableActiveAction({ tableId: table.tableId, isActive });
      pendingTableIdRef.current = null;
      if (!result.ok) {
        toast({ title: "No se pudo actualizar", description: result.message, variant: "error" });
        return;
      }
      toast({
        title: isActive ? "Mesa activada" : "Mesa desactivada",
        variant: "success",
      });
      router.refresh();
    });
  }

  function confirmRotate() {
    if (!rotateTarget) return;
    const tableId = rotateTarget.tableId;
    const nameHint = rotateTarget.name;
    pendingTableIdRef.current = tableId;
    setRotateTarget(null);
    startTransition(async () => {
      const result = await rotateDiningTableQrAction({ tableId });
      pendingTableIdRef.current = null;
      if (!result.ok) {
        toast({ title: "No se pudo rotar el QR", description: result.message, variant: "error" });
        return;
      }
      toast({ title: "QR actualizado", variant: "success" });
      showCredential(result.data, nameHint);
      router.refresh();
    });
  }

  const qrUrl = credential ? buildTableQrUrl(credential.qrToken) : null;
  const credentialCode =
    credential?.code ??
    tables.find((table) => table.tableId === credential?.tableId)?.code ??
    "—";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"
          >
            <ArrowLeft aria-hidden className="size-4" /> Volver al dashboard
          </Link>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
            Brisas del Sinú · Administración
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <QrCode aria-hidden className="size-7 text-lime" /> Mesas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Crea mesas, imprime QR y gestiona cuentas abiertas. Rol: {role === "owner" ? "propietario" : "administrador"}.
          </p>
        </div>
        <Badge variant="lime">{tables.length} mesas</Badge>
      </header>

      {loadError ? (
        <p role="alert" className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {loadError}
        </p>
      ) : null}

      {credential && qrUrl ? (
        <section
          aria-labelledby="qr-credencial-titulo"
          className="rounded-card border border-warning/35 bg-warning/8 p-5"
        >
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <h2 id="qr-credencial-titulo" className="text-lg font-bold">
                Credencial QR de Mesa {credentialCode}
              </h2>
              <p className="mt-1 text-sm font-semibold text-warning">
                Guarda o imprime este QR ahora. No se puede recuperar después.
              </p>
              <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-start">
                <TableQrCode value={qrUrl} label={`QR Mesa ${credentialCode}`} size={180} />
                <PrintableTableQr
                  tableCode={credentialCode}
                  tableName={credentialName}
                  qrUrl={qrUrl}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setCredential(null);
                  setCredentialName(null);
                }}
              >
                Ocultar credencial
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="crear-mesa-titulo"
        className="rounded-card border border-border-soft bg-surface p-5"
      >
        <h2 id="crear-mesa-titulo" className="text-lg font-bold">
          Nueva mesa
        </h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Código"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            maxLength={32}
            placeholder="M1"
            autoComplete="off"
          />
          <TextField
            label="Nombre (opcional)"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Terraza 1"
            autoComplete="off"
          />
          <SelectField
            label="Sucursal"
            name="branchId"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            required
          >
            {branchOptions.length === 0 ? (
              <option value="">Sin sucursales</option>
            ) : (
              branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))
            )}
          </SelectField>
          <div className="flex items-end">
            <Button type="submit" size="md" fullWidth loading={isPending} disabled={!branchId || isPending}>
              Crear mesa
            </Button>
          </div>
        </form>
      </section>

      {tables.length === 0 && !loadError ? (
        <EmptyState
          title="Aún no hay mesas"
          description="Crea la primera mesa e imprime su código QR para los comensales."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => {
            const busy = isPending && pendingTableIdRef.current === table.tableId;
            return (
              <li
                key={table.tableId}
                className="flex flex-col gap-3 rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                      {table.code}
                    </p>
                    <h3 className="mt-1 truncate text-lg font-extrabold">
                      {table.name?.trim() || `Mesa ${table.code}`}
                    </h3>
                  </div>
                  <Badge variant={STATUS_BADGE[table.operationalStatus]}>
                    {STATUS_LABEL[table.operationalStatus]}
                  </Badge>
                </div>

                {table.operationalStatus === "open_account" ? (
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted">Pedidos</dt>
                      <dd className="font-semibold">{table.orderCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Pendiente</dt>
                      <dd className="font-semibold">{formatCurrency(table.outstandingTotal)}</dd>
                    </div>
                  </dl>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2">
                  {table.openSessionId ? (
                    <Link
                      href={`/admin/mesas/cuenta/${table.openSessionId}`}
                      className="inline-flex min-h-11 items-center rounded-button border border-border-soft bg-white/6 px-4 text-sm font-semibold hover:border-lime/50"
                    >
                      Ver cuenta
                    </Link>
                  ) : null}
                  {table.isActive ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy || isPending}
                      loading={busy}
                      onClick={() => handleSetActive(table, false)}
                    >
                      Desactivar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy || isPending}
                      loading={busy}
                      onClick={() => handleSetActive(table, true)}
                    >
                      Activar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || isPending || !table.isActive}
                    onClick={() => setRotateTarget(table)}
                    aria-label={`Rotar QR de mesa ${table.code}`}
                  >
                    <RefreshCw aria-hidden className="size-4" />
                    Rotar QR
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-muted">
        <Link href="/empleado/mesas" className="font-semibold text-lime underline-offset-4 hover:underline">
          Vista operativa de mesas
        </Link>
      </p>

      <Dialog
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null);
        }}
        title="Rotar código QR"
        description="El QR anterior dejará de funcionar."
        footer={
          <>
            <Button type="button" variant="secondary" size="md" onClick={() => setRotateTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" size="md" loading={isPending} onClick={confirmRotate}>
              Rotar QR
            </Button>
          </>
        }
      />
    </div>
  );
}
