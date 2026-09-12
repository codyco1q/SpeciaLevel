import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What kinds of businesses do you work with?",
    answer:
      "Mostly operations-heavy teams — agencies, e-commerce brands, B2B services, and growing startups — that are drowning in manual work and disconnected tools. We also build custom portals and dashboards for larger organizations.",
  },
  {
    question: "How long does a typical implementation take?",
    answer:
      "A full custom build usually ships in 2–6 weeks depending on scope. Audits and blueprints typically land within a week. Retainer clients see continuous improvements every sprint.",
  },
  {
    question: "Do you replace our existing tools or integrate with them?",
    answer:
      "Integrate first. We connect the tools you already pay for — CRM, ERP, accounting, communications — into one coherent system, and only recommend replacing a tool when something better clearly exists.",
  },
  {
    question: "How do you handle data security and access?",
    answer:
      "Every build follows least-privilege access, role-based permissions, and secure storage by default. We ship with documented, encrypted data handling and hand over full ownership of the code and data.",
  },
  {
    question: "We already have some automation in place. Can you still help?",
    answer:
      "Absolutely — that is often the best starting point. We audit what exists, fix what is brittle, and design new automations that layer cleanly on top instead of adding more fragile scripts.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Questions, answered
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need to know before we talk. Anything else — the
            consultation is free.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-white/10 bg-white/5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium sm:text-base [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}