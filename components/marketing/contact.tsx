import { Clock, Mail, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/marketing/contact-form";

const NEXT_STEPS = [
  "We review your request and schedule a 30-minute consultation.",
  "We map your bottleneck and recommend the right package.",
  "You get a blueprint and a clear path — no obligation.",
];

export function Contact() {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
              Book a consultation
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Let&apos;s find where the friction is
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Tell us about your operations and we&apos;ll show you exactly
              what&apos;s worth automating — and how to get there.
            </p>

            <ol className="mt-8 space-y-4">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-indigo-300">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-indigo-300" />
                hello@specialevel.com
              </p>
              <p className="flex items-center gap-2">
                <Clock className="size-4 text-indigo-300" />
                Replies within one business day
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-indigo-300" />
                NDAs available on request
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 sm:p-8 lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}