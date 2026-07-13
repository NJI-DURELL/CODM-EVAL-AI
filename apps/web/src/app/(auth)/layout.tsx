import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flag-stripe h-1 w-full" />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2">
            <span className="font-heading text-xl font-bold tracking-wide text-foreground">
              OG CLAN ENGINES
            </span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
