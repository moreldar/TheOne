import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user && (session.user as { isAdmin?: boolean }).isAdmin;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-neutral-600">
          Sign in with an account listed in <code>ADMIN_EMAILS</code>.
        </p>
        <Link
          href="/api/auth/signin"
          className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-2 font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-8 flex gap-4 border-b border-neutral-200 pb-4 text-sm">
        <Link href="/admin" className="font-medium hover:underline">
          Dashboard
        </Link>
        <Link href="/admin/uploads" className="hover:underline">
          Moderation queue
        </Link>
        <Link href="/admin/orders" className="hover:underline">
          Orders
        </Link>
        <Link href="/admin/styles" className="hover:underline">
          Styles
        </Link>
        <Link href="/admin/products" className="hover:underline">
          Products
        </Link>
      </nav>
      {children}
    </div>
  );
}
