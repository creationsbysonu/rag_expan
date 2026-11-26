"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="md" onClick={signOut}>
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}
