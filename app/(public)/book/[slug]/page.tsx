import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingProfileBySlug } from "@/lib/actions/calendar";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PublicBookingView } from "./public-booking-view";
import { CalendarX } from "lucide-react";

interface PublicBookingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PublicBookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicBookingProfileBySlug(slug);

  if (!profile) {
    return {
      title: "Booking Profile Not Found - SpeciaLevel",
    };
  }

  return {
    title: `${profile.title} - ${profile.hostName} | SpeciaLevel`,
    description: profile.description || `Book an appointment with ${profile.hostName}.`,
  };
}

export default async function PublicBookingPage({
  params,
}: PublicBookingPageProps) {
  const { slug } = await params;
  const [profile, dictionary] = await Promise.all([
    getPublicBookingProfileBySlug(slug),
    getDictionary(),
  ]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {dictionary.platform?.calendar?.public?.notFound ?? "Booking Profile Not Found"}
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {dictionary.platform?.calendar?.public?.notFoundHint ??
                "This scheduler link is inactive or does not exist."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <PublicBookingView profile={profile} dictionary={dictionary} />;
}
