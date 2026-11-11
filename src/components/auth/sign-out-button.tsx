import { signOut } from "@/lib/data/actions";
import { buttonClass } from "@/components/ui";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className={buttonClass("secondary", "sm")}>Salir</button>
    </form>
  );
}
