import { z } from "zod";

export const externalSmsInputSchema = z.object({
  contactId: z.string().uuid("Invalid contact ID"),
  body: z.string().trim().min(1, "Message text is required").max(1600, "Message is too long"),
  fromNumber: z.string().trim().min(1, "Outbound phone number is required").optional().or(z.literal("")),
});

export type ExternalSmsInput = z.infer<typeof externalSmsInputSchema>;
