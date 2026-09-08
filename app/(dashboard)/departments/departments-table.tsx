"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/actions/departments";
import {
  departmentSchema,
  initialDepartmentActionState,
  type DepartmentFormValues,
} from "@/lib/validations/departments";
import type { DepartmentWithCount } from "./page";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/* ============================================================
 * Create / Edit dialog
 * ============================================================ */

function DepartmentDialog({
  department,
  open,
  onOpenChange,
}: {
  department: DepartmentWithCount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = department !== null;

  const formAction = isEditing ? updateDepartment : createDepartment;

  const [state, action, isPending] = useActionState(
    formAction,
    initialDepartmentActionState
  );

  // Close the dialog once the server action confirms a successful write.
  useEffect(() => {
    if (state.status === "success") {
      onOpenChange(false);
    }
  }, [state.status, onOpenChange]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: department?.name ?? "",
      description: department?.description ?? "",
    },
  });

  async function onSubmit(values: DepartmentFormValues) {
    const formData = new FormData();
    if (isEditing && department) {
      formData.set("id", department.id);
    }
    formData.set("name", values.name);
    formData.set("description", values.description ?? "");
    action(formData);
  }

  const nameError = errors.name?.message ?? state.fieldErrors?.name?.[0];
  const descError =
    errors.description?.message ?? state.fieldErrors?.description?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit department" : "New department"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this department's details."
              : "Create a department to organize employees."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department-name">Name</Label>
            <Input
              id="department-name"
              placeholder="e.g. Marketing"
              aria-invalid={Boolean(nameError)}
              {...register("name")}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department-description">Description</Label>
            <Textarea
              id="department-description"
              placeholder="What does this team do?"
              rows={3}
              aria-invalid={Boolean(descError)}
              {...register("description")}
            />
            {descError && (
              <p className="text-sm text-destructive">{descError}</p>
            )}
          </div>

          {state.status === "error" && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Delete confirmation dialog
 * ============================================================ */

function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
}: {
  department: DepartmentWithCount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, isPending] = useActionState(
    deleteDepartment,
    initialDepartmentActionState
  );

  // Close once deleted.
  useEffect(() => {
    if (state.status === "success") {
      onOpenChange(false);
    }
  }, [state.status, onOpenChange]);

  function handleDelete() {
    const formData = new FormData();
    formData.set("id", department.id);
    action(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete department?</DialogTitle>
          <DialogDescription>
            {department.employeeCount > 0 ? (
              <>
                <strong className="text-foreground">{department.name}</strong>{" "}
                still has {department.employeeCount} employee
                {department.employeeCount === 1 ? "" : "s"} assigned.
                Reassign or delete those employees before removing this
                department, so no one is left without a department.
              </>
            ) : (
              <>
                This will permanently delete{" "}
                <strong className="text-foreground">{department.name}</strong>.
                This action cannot be undone.
              </>
            )}
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
            disabled={isPending || department.employeeCount > 0}
          >
            {isPending
              ? "Deleting…"
              : department.employeeCount > 0
                ? "Can't delete yet"
                : "Delete department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ============================================================
 * Table
 * ============================================================ */

export function DepartmentsTable({
  departments,
  canManage,
}: {
  departments: DepartmentWithCount[];
  canManage: boolean;
}) {
  const [dialogState, setDialogState] = useState<{
    mode: "create" | "edit" | "delete";
    department: DepartmentWithCount | null;
  } | null>(null);

  return (
    <>
      {departments.length === 0 ? (
        <>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">0 departments</p>
          {canManage && (
            <Button
              onClick={() => setDialogState({ mode: "create", department: null })}
            >
              <Plus />
              New department
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No departments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Create your first department to start organizing employees."
              : "Departments will appear here once they are created."}
          </p>
        </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {departments.length} department{departments.length === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button
            onClick={() => setDialogState({ mode: "create", department: null })}
          >
            <Plus />
            New department
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Created</TableHead>
              {canManage && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium">
                  {department.name}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {department.description || "—"}
                </TableCell>
                <TableCell>{department.employeeCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(department.created_at)}
                </TableCell>
                {canManage && (
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
                        <DropdownMenuItem
                          onClick={() =>
                            setDialogState({ mode: "edit", department })
                          }
                        >
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            setDialogState({ mode: "delete", department })
                          }
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
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
        <DepartmentDialog
          department={null}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
        />
      )}

      {dialogState?.mode === "edit" && dialogState.department && (
        <DepartmentDialog
          department={dialogState.department}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
        />
      )}

      {dialogState?.mode === "delete" && dialogState.department && (
        <DeleteDepartmentDialog
          department={dialogState.department}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
        />
      )}
    </>
  );
}