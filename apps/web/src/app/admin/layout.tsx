"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Icon } from "@/components/icon";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const user = session?.user as { role?: string } | undefined;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login?next=/admin");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dim text-sm">
        Lade …
      </div>
    );
  }

  if (!session || user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-[1600px] gap-0 px-0">
      <AdminSidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8">
        {/* Mobile-Toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-border-strong px-3 py-2 text-sm text-foreground transition hover:bg-surface md:hidden"
        >
          <Icon name="menu" size={16} />
          Admin-Menü
        </button>
        {children}
      </main>
    </div>
  );
}
