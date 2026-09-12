"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createRole,
  deleteRole,
  updateRolePermissions,
  type PermissionDefinition,
  type RoleWithPermissions,
} from "@/lib/actions/roles";
import { roleNameSchema } from "@/lib/validations/roles";

// ================================================================
// Permission catalog grouping
// ================================================================

const GROUP_ORDER = [
  "dashboard",
  "calendar",
  "time",
  "employees",
  "departments",
  "roles",
  "settings",
];

const GROUP_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  time: "Time Tracking",
  employees: "Employees",
  departments: "Departments",
  roles: "Roles & Permissions",
  settings: "Settings",
};

interface PermissionGroup {
  module: string;
  label: string;
  permissions: PermissionDefinition[];
}

function prettyModule(module: string): string {
  return module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildGroups(catalog: PermissionDefinition[]): PermissionGroup[] {
  const byModule = new Map<string, PermissionDefinition[]>();
  for (const permission of catalog) {
    if (!byModule.has(permission.module)) {
      byModule.set(permission.module, []);
    }
    byModule.get(permission.module)!.push(permission);
  }

  const modules = Array.from(byModule.keys()).sort((a, b) => {
    const idxA = GROUP_ORDER.indexOf(a);
    const idxB = GROUP_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  return modules.map((module) => ({
    module,
    label: GROUP_LABELS[module] ?? prettyModule(module),
    permissions: byModule
      .get(module)!
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key)),
  }));
}

// ================================================================
// Shared grouped permission checklist (matrix + dialog)
// ================================================================

function PermissionChecklist({
  catalog,
  grantedKeys,
  disabled,
  onToggle,
}: {
  catalog: PermissionDefinition[];
  grantedKeys: string[];
  disabled: boolean;
  onToggle: (key: string) => void;
}) {
  const groups = buildGroups(catalog);

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const grantedCount = group.permissions.filter((permission) =>
          grantedKeys.includes(permission.key)
        ).length;

        return (
          <details
            key={group.module}
            open
            className="group rounded-lg border border-border"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                {group.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {grantedCount}/{group.permissions.length} granted
              </span>
            </summary>
            <div className="space-y-1 border-t px-2 py-2">
              {group.permissions.map((permission) => (
                <label
                  key={permission.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60",
                    disabled &&
                      "cursor-not-allowed opacity-60 hover:bg-transparent"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <Checkbox
                      checked={grantedKeys.includes(permission.key)}
                      disabled={disabled}
                      onCheckedChange={() => onToggle(permission.key)}
                    />
                  </div>
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      {permission.name}
                    </span>
                    {permission.description && (
                      <span className="block text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
// ================================================================
// Create / Edit role dialog
// ================================================================

function RoleFormDialog({
  role,
  permissionCatalog,
  onOpenChange,
  onSaved,
}: {
  role: RoleWithPermissions | null;
  permissionCatalog: PermissionDefinition[];
  onOpenChange: (open: boolean) => void;
  onSaved: (roleId?: string) => void;
}) {
  const isEditing = role !== null;

  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    role?.permissionKeys ?? []
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string }>({
    resolver: zodResolver(roleNameSchema),
    defaultValues: { name: role?.name ?? "" },
  });

  const nameError = errors.name?.message;

  function togglePermission(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function onSubmit(values: { name: string }) {
    setErrorMessage(null);
    startTransition(async () => {
      const result =
        isEditing && role
          ? await updateRolePermissions(role.id, {
              name: values.name,
              permissionKeys: selectedKeys,
            })
          : await createRole({
              name: values.name,
              permissionKeys: selectedKeys,
            });

      if (result.status === "success") {
        const createdRoleId = (result as { roleId?: string }).roleId;
        onSaved(isEditing ? undefined : createdRoleId);
      } else {
        setErrorMessage(
          result.error ??
            result.fieldErrors?.name?.[0] ??
            "Could not save the role. Please try again."
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit "${role!.name}"` : "Create custom role"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the role name and its tailored set of permissions."
              : "Give your custom role a name and choose which permissions it grants."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              placeholder="e.g. Sales specialist"
              aria-invalid={Boolean(nameError)}
              {...register("name")}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Permissions{" "}
              <span className="font-normal text-muted-foreground">
                ({selectedKeys.length} selected)
              </span>
            </Label>
            <div className="max-h-[38vh] overflow-y-auto rounded-lg border p-3">
              <PermissionChecklist
                catalog={permissionCatalog}
                grantedKeys={selectedKeys}
                disabled={false}
                onToggle={togglePermission}
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEditing ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// ================================================================
// Delete role dialog (with assigned-member check)
// ================================================================

function DeleteRoleDialog({
  role,
  onOpenChange,
  onDeleted,
}: {
  role: RoleWithPermissions;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blocked = role.memberCount > 0;

  function handleDelete() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.status === "success") {
        onDeleted();
      } else {
        setErrorMessage(
          result.error ?? "Could not delete the role. Please try again."
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{role.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This permanently removes the role and all of its permissions.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              This role still has {role.memberCount} employee
              {role.memberCount === 1 ? "" : "s"} assigned. Reassign them
              before deleting this role.
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No employees are currently assigned to this role, so it can be
            deleted safely.
          </p>
        )}

        {errorMessage && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || blocked}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Delete role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ================================================================
// Main manager: role selector + permission matrix
// ================================================================

interface RolesManagerProps {
  roles: RoleWithPermissions[];
  permissionCatalog: PermissionDefinition[];
  canManage: boolean;
}

type SaveMessage =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

type DialogState =
  | { mode: "create"; role: null }
  | { mode: "edit"; role: RoleWithPermissions }
  | { mode: "delete"; role: RoleWithPermissions };

export function RolesManager({
  roles,
  permissionCatalog,
  canManage,
}: RolesManagerProps) {
  const router = useRouter();

  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id ?? ""
  );
  // Per-role permission overrides present ONLY while a role has unsaved
  // changes. A role without an entry uses its server-side permission keys,
  // so new server data (after router.refresh) flows through automatically.
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  // Falls back to the first role when the selected id no longer exists
  // (e.g. right after deleting it, before the refresh lands).
  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0];

  function effectivePermissionKeys(role: RoleWithPermissions): string[] {
    return overrides[role.id] ?? role.permissionKeys;
  }

  function hasUnsavedChanges(role: RoleWithPermissions): boolean {
    return overrides[role.id] !== undefined;
  }

  function selectRole(roleId: string) {
    setSelectedRoleId(roleId);
    setSaveMessage(null);
  }

  function togglePermission(roleId: string, key: string) {
    setOverrides((prev) => {
      const role = roles.find((r) => r.id === roleId);
      if (!role) return prev;
      const current = prev[roleId] ?? role.permissionKeys;
      const hasKey = current.includes(key);
      return {
        ...prev,
        [roleId]: hasKey
          ? current.filter((k) => k !== key)
          : [...current, key],
      };
    });
  }

  function handleSavePermissions() {
    if (!selectedRole) return;
    setSaveMessage(null);
    startTransition(async () => {
      const keys = effectivePermissionKeys(selectedRole);
      const result = await updateRolePermissions(selectedRole.id, {
        permissionKeys: keys,
      });

      if (result.status === "success") {
        // Drop the override — the committed keys now match the server, which
        // router.refresh() will re-render.
        setOverrides((prev) => {
          if (!(selectedRole.id in prev)) return prev;
          const next = { ...prev };
          delete next[selectedRole.id];
          return next;
        });
        setSaveMessage({
          kind: "success",
          text: `Changes to "${selectedRole.name}" saved.`,
        });
        router.refresh();
      } else {
        setSaveMessage({
          kind: "error",
          text: result.error ?? "Could not save the permissions. Please try again.",
        });
      }
    });
  }
const systemRoles = roles.filter((role) => role.isSystem);
  const customRoles = roles.filter((role) => !role.isSystem);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Roles &amp; Permissions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control what each role can see and do across SpeciaLevel.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogState({ mode: "create", role: null })}>
            <Plus />
            Create custom role
          </Button>
        )}
      </div>

      {!selectedRole ? (
        <Card>
          <CardContent>
            <p className="py-6 text-sm text-muted-foreground">
              No roles found for this organization.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* ---------------- Role selector ---------------- */}
          <div className="space-y-4">
            {systemRoles.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  System roles
                </p>
                <div className="space-y-1">
                  {systemRoles.map((role) => (
                    <RoleSelectorItem
                      key={role.id}
                      role={role}
                      isSelected={role.id === selectedRole.id}
                      onClick={() => selectRole(role.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {customRoles.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Custom roles
                </p>
                <div className="space-y-1">
                  {customRoles.map((role) => (
                    <RoleSelectorItem
                      key={role.id}
                      role={role}
                      isSelected={role.id === selectedRole.id}
                      onClick={() => selectRole(role.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---------------- Permission matrix ---------------- */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{selectedRole.name}</CardTitle>
                      <Badge variant={selectedRole.isSystem ? "secondary" : "outline"}>
                        {selectedRole.isSystem ? "System" : "Custom"}
                      </Badge>
                      {selectedRole.key === "owner" && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="size-3" />
                          Locked
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {selectedRole.description ??
                        (selectedRole.isSystem
                          ? "System-defined role for this organization."
                          : "Custom role for this organization.")}
                    </CardDescription>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {selectedRole.memberCount} assigned member
                      {selectedRole.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  {canManage && !selectedRole.isSystem && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDialogState({ mode: "edit", role: selectedRole })
                        }
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setDialogState({ mode: "delete", role: selectedRole })
                        }
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {selectedRole.key === "owner" && (
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      The Owner role always retains full access to the
                      organization. Its permissions are locked and cannot be
                      revoked or changed.
                    </p>
                  </div>
                )}

                <PermissionChecklist
                  catalog={permissionCatalog}
                  grantedKeys={effectivePermissionKeys(selectedRole)}
                  disabled={selectedRole.key === "owner" || !canManage}
                  onToggle={(key) => togglePermission(selectedRole.id, key)}
                />
{saveMessage && (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      saveMessage.kind === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    {saveMessage.kind === "success" ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0" />
                    )}
                    {saveMessage.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    {hasUnsavedChanges(selectedRole)
                      ? "You have unsaved changes for this role."
                      : `${effectivePermissionKeys(selectedRole).length} of ${permissionCatalog.length} permissions granted`}
                  </p>

                  {canManage && selectedRole.key !== "owner" && (
                    <Button
                      onClick={handleSavePermissions}
                      disabled={isPending || !hasUnsavedChanges(selectedRole)}
                    >
                      {isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Save />
                      )}
                      Save Changes
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ---------------- Dialogs ---------------- */}
      {dialogState && dialogState.mode !== "delete" && (
        <RoleFormDialog
          key={dialogState.role?.id ?? "new"}
          role={dialogState.role}
          permissionCatalog={permissionCatalog}
          onOpenChange={(open) => !open && setDialogState(null)}
          onSaved={(roleId) => {
            setDialogState(null);
            if (roleId) {
              setSelectedRoleId(roleId);
            }
            setSaveMessage(null);
            router.refresh();
          }}
        />
      )}

      {dialogState?.mode === "delete" && (
        <DeleteRoleDialog
          key={dialogState.role.id}
          role={dialogState.role}
          onOpenChange={(open) => !open && setDialogState(null)}
          onDeleted={() => {
            setDialogState(null);
            setSaveMessage(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ================================================================
// Role selector list item
// ================================================================

function RoleSelectorItem({
  role,
  isSelected,
  onClick,
}: {
  role: RoleWithPermissions;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
        isSelected
          ? "border-border bg-accent text-accent-foreground"
          : "border-transparent hover:bg-accent/50"
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-sm font-medium">{role.name}</span>
        <Badge variant={role.isSystem ? "secondary" : "outline"}>
          {role.isSystem ? "System" : "Custom"}
        </Badge>
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3" />
        {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
      </span>
    </button>
  );
}