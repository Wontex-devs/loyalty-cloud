"use client";

import { useDemo } from "@/lib/demo/store";
import { signOut } from "@/lib/data/actions";
import { buttonClass, ButtonLink } from "@/components/ui";

export function SignOutButton() {
  const { mode } = useDemo();
  if (mode === "demo")
    return (
      <ButtonLink href="/login" variant="secondary" size="sm">
        Salir
      </ButtonLink>
    );
  return (
    <form action={signOut}>
      <button className={buttonClass("secondary", "sm")}>Salir</button>
    </form>
  );
}
