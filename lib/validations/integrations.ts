import { z } from "zod";
import type { IntegrationCategory, IntegrationProvider } from "@/types/database";

export const INTEGRATION_CATEGORIES = ["payment", "social", "telecom"] as const;

export interface IntegrationFieldConfig {
  name: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder: string;
  required?: boolean;
  helperText?: string;
  options?: { value: string; label: string }[];
}

export interface ProviderDefinition {
  id: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  description: string;
  badge: string;
  docsUrl: string;
  fields: IntegrationFieldConfig[];
  hasEnvironmentToggle?: boolean;
  hasDefaultToggle?: boolean;
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  // Payments
  {
    id: "stripe",
    name: "Stripe",
    category: "payment",
    description: "Accept credit cards, Apple Pay, Google Pay, and localized bank transfers globally.",
    badge: "Cards & Wallets",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    hasEnvironmentToggle: true,
    hasDefaultToggle: true,
    fields: [
      {
        name: "publishable_key",
        label: "Publishable Key",
        type: "text",
        placeholder: "pk_live_... or pk_test_...",
        required: true,
        helperText: "Starts with pk_live_ or pk_test_",
      },
      {
        name: "secret_key",
        label: "Secret Key",
        type: "password",
        placeholder: "sk_live_... or sk_test_...",
        required: true,
        helperText: "Keep this secret. Never share publicly.",
      },
      {
        name: "webhook_secret",
        label: "Webhook Signing Secret",
        type: "password",
        placeholder: "whsec_...",
        required: false,
        helperText: "Optional for instant payment status reconciliation.",
      },
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payment",
    description: "Enable checkout with PayPal balance, Venmo, Pay in 4, and international credit cards.",
    badge: "Digital Wallet",
    docsUrl: "https://developer.paypal.com/dashboard/applications",
    hasEnvironmentToggle: true,
    hasDefaultToggle: true,
    fields: [
      {
        name: "client_id",
        label: "Client ID",
        type: "text",
        placeholder: "Client ID from PayPal Developer Portal",
        required: true,
      },
      {
        name: "client_secret",
        label: "Client Secret",
        type: "password",
        placeholder: "••••••••••••••••",
        required: true,
      },
      {
        name: "webhook_id",
        label: "Webhook ID",
        type: "text",
        placeholder: "e.g. 9JA76412T8992015H",
        required: false,
      },
    ],
  },
  {
    id: "paymob",
    name: "Paymob",
    category: "payment",
    description: "Leading MENA gateway: Visa, Mastercard, Meeza, Mobile Wallets (Vodafone Cash), and Aman.",
    badge: "MENA & Wallets",
    docsUrl: "https://accept.paymob.com/portal/en/settings",
    hasEnvironmentToggle: true,
    hasDefaultToggle: true,
    fields: [
      {
        name: "api_key",
        label: "API Key",
        type: "password",
        placeholder: "Paymob API Authentication Key",
        required: true,
      },
      {
        name: "iframe_id",
        label: "iFrame ID",
        type: "text",
        placeholder: "e.g. 123456",
        required: true,
      },
      {
        name: "integration_id",
        label: "Integration ID (Cards)",
        type: "text",
        placeholder: "e.g. 789012",
        required: true,
      },
      {
        name: "hmac_secret",
        label: "HMAC Secret Key",
        type: "password",
        placeholder: "Paymob HMAC secret hash",
        required: true,
      },
    ],
  },
  {
    id: "paytabs",
    name: "PayTabs",
    category: "payment",
    description: "Regional payment orchestrator supporting Mada, Knet, Visa, Mastercard, and Apple Pay across GCC.",
    badge: "GCC & Mada",
    docsUrl: "https://merchant.paytabs.com",
    hasEnvironmentToggle: true,
    hasDefaultToggle: true,
    fields: [
      {
        name: "profile_id",
        label: "Profile ID",
        type: "text",
        placeholder: "e.g. 42319",
        required: true,
      },
      {
        name: "server_key",
        label: "Server Key",
        type: "password",
        placeholder: "e.g. SHJNDKZL2Z-...",
        required: true,
      },
      {
        name: "client_key",
        label: "Client Key",
        type: "text",
        placeholder: "e.g. CKKM97-...",
        required: true,
      },
    ],
  },
];

PROVIDER_DEFINITIONS.push(
  {
    id: "fawry",
    name: "Fawry Pay",
    category: "payment",
    description: "Egypt's ubiquitous electronic cash network: Reference numbers at retail POS stores and Fawry Yellow Card.",
    badge: "Egypt Cash & POS",
    docsUrl: "https://developer.fawry.com",
    hasEnvironmentToggle: true,
    hasDefaultToggle: true,
    fields: [
      {
        name: "merchant_code",
        label: "Merchant Code",
        type: "text",
        placeholder: "Fawry Merchant Account Code",
        required: true,
      },
      {
        name: "security_key",
        label: "Security Key / Hash",
        type: "password",
        placeholder: "Fawry Secret Security Key",
        required: true,
      },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "social",
    description: "Meta WhatsApp Cloud API for automated notifications, customer support, and direct marketing campaigns.",
    badge: "Official Meta Cloud API",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    hasEnvironmentToggle: false,
    fields: [
      {
        name: "phone_number_id",
        label: "Phone Number ID",
        type: "text",
        placeholder: "e.g. 106492305820412",
        required: true,
        helperText: "Identifier for your WhatsApp business phone number",
      },
      {
        name: "waba_id",
        label: "WhatsApp Business Account ID (WABA)",
        type: "text",
        placeholder: "e.g. 109823485729104",
        required: true,
      },
      {
        name: "access_token",
        label: "Permanent System User Access Token",
        type: "password",
        placeholder: "EAAG...",
        required: true,
        helperText: "Must have whatsapp_business_messaging permissions",
      },
      {
        name: "verify_token",
        label: "Webhook Verify Token",
        type: "text",
        placeholder: "custom_random_verification_string",
        required: false,
        helperText: "Shared secret for Meta webhook handshake",
      },
    ],
  },
  {
    id: "meta_messenger",
    name: "Meta Messenger",
    category: "social",
    description: "Sync Facebook Page inbox, route incoming conversations to team inboxes, and send auto-replies.",
    badge: "Facebook Pages",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform",
    hasEnvironmentToggle: false,
    fields: [
      {
        name: "page_id",
        label: "Facebook Page ID",
        type: "text",
        placeholder: "e.g. 104829104928102",
        required: true,
      },
      {
        name: "access_token",
        label: "Page Access Token",
        type: "password",
        placeholder: "EAAG...",
        required: true,
        helperText: "Requires pages_messaging permission",
      },
      {
        name: "app_secret",
        label: "Meta App Secret",
        type: "password",
        placeholder: "••••••••••••••••",
        required: true,
      },
      {
        name: "verify_token",
        label: "Webhook Verify Token",
        type: "text",
        placeholder: "custom_webhook_secret_token",
        required: false,
      },
    ],
  },
  {
    id: "instagram",
    name: "Instagram Direct",
    category: "social",
    description: "Manage direct messages, story replies, and customer leads from your Instagram Business profile.",
    badge: "Instagram Graph API",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/instagram",
    hasEnvironmentToggle: false,
    fields: [
      {
        name: "page_id",
        label: "Connected Page / IG Account ID",
        type: "text",
        placeholder: "e.g. 17841400000000000",
        required: true,
      },
      {
        name: "access_token",
        label: "Instagram Graph API Access Token",
        type: "password",
        placeholder: "EAAG...",
        required: true,
        helperText: "Requires instagram_basic, instagram_manage_messages",
      },
      {
        name: "app_secret",
        label: "Meta App Secret",
        type: "password",
        placeholder: "••••••••••••••••",
        required: true,
      },
    ],
  }
);

// Base Validation Schemas
export const saveIntegrationSchema = z.object({
  provider: z.enum([
    "stripe",
    "paypal",
    "paymob",
    "paytabs",
    "fawry",
    "whatsapp",
    "meta_messenger",
    "instagram",
  ]),
  category: z.enum(["payment", "social", "telecom"]),
  credentials: z.record(z.string(), z.any()),
  config: z.record(z.string(), z.any()).default({}),
});

export type SaveIntegrationInput = z.infer<typeof saveIntegrationSchema>;

export const disconnectIntegrationSchema = z.object({
  provider: z.enum([
    "stripe",
    "paypal",
    "paymob",
    "paytabs",
    "fawry",
    "whatsapp",
    "meta_messenger",
    "instagram",
  ]),
});

export type DisconnectIntegrationInput = z.infer<typeof disconnectIntegrationSchema>;
