import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flag-stripe h-1 w-full shrink-0" />
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6">
        <Link href="/dashboard" className="font-heading text-lg font-bold tracking-wide">
          OG CLAN ENGINES
        </Link>
        <UserMenu email={user.email ?? "Organizer"} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
