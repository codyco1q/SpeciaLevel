import { Clock, Mail, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/marketing/contact-form";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function Contact({ dict }: { dict: Dictionary["contact"] }) {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-300">
              {dict.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {dict.title}
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {dict.subtitle}
            </p>

            <ol className="mt-8 space-y-4">
              {dict.steps.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-3 text-sm text-muted-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card/60 text-xs font-semibold text-indigo-500 dark:text-indigo-300">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="mt-8 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-indigo-500 dark:text-indigo-300" />
                {dict.email}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="size-4 text-indigo-500 dark:text-indigo-300" />
                {dict.replyTime}
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-indigo-500 dark:text-indigo-300" />
                {dict.ndas}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-6 sm:p-8 lg:col-span-3">
            <ContactForm dict={dict.form} />
          </div>
        </div>
      </div>
    </section>
  );
}