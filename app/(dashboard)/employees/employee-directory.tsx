"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/actions/employees";
import {
  employeeSchema,
  employeeStatusBadgeVariants,
  employeeStatusLabels,
  initialEmployeeActionState,
  type EmployeeFormValues,
} from "@/lib/validations/employees";
import type { EmployeeRow } from "./page";

const EMPLOYEE_STATUSES = ["active", "suspended", "invited"] as const;

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface RoleOption {
  id: string;
  name: string;
  isSystem: boolean;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/* ============================================================
 * Create / Edit employee dialog
 * ============================================================ */

function EmployeeDialog({
  employee,
  departments,
  roles,
  open,
  onOpenChange,
}: {
  employee: EmployeeRow | null;
  departments: DepartmentOption[];
  roles: RoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = employee !== null;

  const formAction = isEditing ? updateEmployee : createEmployee;

  const [state, action, isPending] = useActionState(
    formAction,
    initialEmployeeActionState
  );

  // Close once the server action confirms a successful write.
  useEffect(() => {
    if (state.status === "success") {
      onOpenChange(false);
    }
  }, [state.status, onOpenChange]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: employee?.fullName ?? "",
      email: employee?.email ?? "",
      jobTitle: employee?.jobTitle ?? "",
      departmentId: employee?.departmentId ?? "",
      roleId: employee?.roleId ?? "",
      status: (employee?.status ?? "active") as EmployeeFormValues["status"],
    },
  });

  async function onSubmit(values: EmployeeFormValues) {
    const formData = new FormData();
    if (isEditing && employee) {
      formData.set("id", employee.id);
    }
    formData.set("fullName", values.fullName);
    formData.set("email", values.email);
    formData.set("jobTitle", values.jobTitle ?? "");
    formData.set("departmentId", values.departmentId ?? "");
    formData.set("roleId", values.roleId ?? "");
    formData.set("status", values.status);
    action(formData);
  }

  const fullNameError =
    errors.fullName?.message ?? state.fieldErrors?.fullName?.[0];
  const emailError = errors.email?.message ?? state.fieldErrors?.email?.[0];
  const jobTitleError =
    errors.jobTitle?.message ?? state.fieldErrors?.jobTitle?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this employee's details and organizational access."
              : "Create an account and add someone to your organization."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee-full-name">Full name</Label>
            <Input
              id="employee-full-name"
              placeholder="Jane Smith"
              autoComplete="off"
              aria-invalid={Boolean(fullNameError)}
              {...register("fullName")}
            />
            {fullNameError && (
              <p className="text-sm text-destructive">{fullNameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-email">Email</Label>
            <Input
              id="employee-email"
              type="email"
              placeholder="jane@company.com"
              autoComplete="off"
              aria-invalid={Boolean(emailError)}
              {...register("email")}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-job-title">Job title</Label>
            <Input
              id="employee-job-title"
              placeholder="e.g. Account Executive"
              autoComplete="off"
              aria-invalid={Boolean(jobTitleError)}
              {...register("jobTitle")}
            />
            {jobTitleError && (
              <p className="text-sm text-destructive">{jobTitleError}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Department</Label>
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger className="w-full" size="md">
                      <SelectValue placeholder="No department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger className="w-full" size="md">
                      <SelectValue placeholder="No role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                          {role.isSystem ? " (system)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:w-48" size="md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {employeeStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {state.status === "error" && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
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
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
/* ============================================================
 * Delete employee dialog
 * ============================================================ */

function DeleteEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, isPending] = useActionState(
    deleteEmployee,
    initialEmployeeActionState
  );
  // Close once deleted.
  useEffect(() => {
    if (state.status === "success") {
      onOpenChange(false);
    }
  }, [state.status, onOpenChange]);

  function handleDelete() {
    const formData = new FormData();
    formData.set("id", employee.id);
    action(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete employee?</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <strong className="text-foreground">{employee.fullName}</strong>
            &apos;s account, remove their profile, and revoke their access.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {state.status === "error" && state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
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
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ============================================================
 * Directory (search + filters + table)
 * ============================================================ */

export function EmployeeDirectory({
  employees,
  departments,
  roles,
  canCreate,
  canUpdate,
  canDelete,
}: {
  employees: EmployeeRow[];
  departments: DepartmentOption[];
  roles: RoleOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogState, setDialogState] = useState<{
    mode: "create" | "edit" | "delete";
    employee: EmployeeRow | null;
  } | null>(null);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (query) {
        const haystack = `${employee.fullName} ${employee.email}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      if (
        departmentFilter !== "all" &&
        employee.departmentId !== departmentFilter
      ) {
        return false;
      }
      if (roleFilter !== "all" && employee.roleId !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [employees, search, departmentFilter, roleFilter]);

  return (
    <>
      {employees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No employees yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canCreate
              ? "Add your first employee to start building your team."
              : "Employees will appear here once they are added."}
          </p>
          {canCreate && (
            <Button
              className="mt-4"
              onClick={() => setDialogState({ mode: "create", employee: null })}
            >
              <Plus />
              Add employee
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-64 pl-8"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button
            onClick={() => setDialogState({ mode: "create", employee: null })}
          >
            <Plus />
            Add employee
          </Button>
        )}
      </div>
<div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {(canUpdate || canDelete) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No employees match your search.
                </TableCell>
              </TableRow>
            )}
            {filteredEmployees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initials(employee.fullName)}
                    </div>
                    <span className="font-medium">{employee.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {employee.email}
                </TableCell>
                <TableCell>{employee.jobTitle || "—"}</TableCell>
                <TableCell>{employee.departmentName || "—"}</TableCell>
                <TableCell>
                  {employee.roleNames.length > 0
                    ? employee.roleNames.join(", ")
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      employeeStatusBadgeVariants[
                        employee.status as keyof typeof employeeStatusBadgeVariants
                      ] ?? "secondary"
                    }
                  >
                    {employeeStatusLabels[
                      employee.status as keyof typeof employeeStatusLabels
                    ] ?? employee.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(employee.createdAt)}
                </TableCell>
                {(canUpdate || canDelete) && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal />
                          <span className="sr-only">Open actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {canUpdate && (
                          <DropdownMenuItem
                            onClick={() =>
                              setDialogState({ mode: "edit", employee })
                            }
                          >
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setDialogState({ mode: "delete", employee })
                              }
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
          </div>
        </>
      )}

      {dialogState?.mode === "create" && (
        <EmployeeDialog
          employee={null}
          departments={departments}
          roles={roles}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
        />
      )}

      {dialogState?.mode === "edit" && dialogState.employee && (
        <EmployeeDialog
          employee={dialogState.employee}
          departments={departments}
          roles={roles}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
        />
      )}

      {dialogState?.mode === "delete" && dialogState.employee && (
        <DeleteEmployeeDialog
          employee={dialogState.employee}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
        />
      )}
    </>
  );
}