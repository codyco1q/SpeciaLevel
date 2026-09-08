import { getCurrentUserContext } from "@/lib/auth/session";

export default async function EmployeesPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Employee management — coming in a future milestone.
      </p>
    </div>
  );
}
