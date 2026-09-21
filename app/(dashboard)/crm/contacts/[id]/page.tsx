import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Backward compatibility redirect: /crm/contacts/[id] -> /contacts/[id]
 */
export default async function LegacyContactProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/contacts/${id}`);
}
