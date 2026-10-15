"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "./ui";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
  }

  return (
    <Button variant="ghost" onClick={logout} loading={loading} data-leaves-page>
      {!loading && <LogOut size={14} aria-hidden />}
      Sign out
    </Button>
  );
}
