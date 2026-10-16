"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  verifyAdminCredentials,
  setAdminSession,
  clearAdminSession,
  getAdminConfig,
} from "@/lib/auth/admin";

export interface AdminAuthResult {
  success: boolean;
  error?: string;
}

export async function adminLoginAction(
  formData: FormData | { username: string; password: string }
): Promise<AdminAuthResult> {
  let username = "";
  let password = "";

  if (formData instanceof FormData) {
    username = (formData.get("username") as string) || "";
    password = (formData.get("password") as string) || "";
  } else if (typeof formData === "object" && formData !== null) {
    username = formData.username || "";
    password = formData.password || "";
  }

  const isValid = verifyAdminCredentials(username, password);
  if (!isValid) {
    return {
      success: false,
      error: "Invalid username or password. Please verify your admin credentials.",
    };
  }

  const config = getAdminConfig();
  await setAdminSession(config.username);
  revalidatePath("/admin");
  revalidatePath("/super-admin");

  return { success: true };
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSession();
  revalidatePath("/admin");
  revalidatePath("/super-admin");
  redirect("/admin/login");
}
