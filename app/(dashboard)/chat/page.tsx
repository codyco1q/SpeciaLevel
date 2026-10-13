import { redirect } from "next/navigation";

interface ChatPageProps {
  searchParams: Promise<{ channel?: string }>;
}

export default async function ChatRedirectPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  if (params?.channel) {
    redirect(`/messaging/internal/${encodeURIComponent(params.channel)}`);
  }
  redirect("/messaging/internal");
}

