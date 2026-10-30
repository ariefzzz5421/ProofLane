"use client";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await fetch("/api/v1/admin/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
