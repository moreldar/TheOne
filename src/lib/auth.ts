import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

/**
 * Auth.js (NextAuth v5) config. Guest checkout is fully supported without
 * any account — this only governs the *optional* logged-in experience
 * (order history, claiming past guest orders by email).
 *
 * Google is wired as an example OAuth provider; add more (Apple, email
 * magic link, etc.) the same way. Email/password is intentionally not
 * included — magic-link-style auth fits a low-frequency purchase flow
 * better than a password users will forget.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        (session.user as typeof session.user & { id: string; isAdmin: boolean }).id = user.id;
        (session.user as typeof session.user & { id: string; isAdmin: boolean }).isAdmin =
          config.admin.emails.includes((user.email ?? "").toLowerCase());
      }
      return session;
    },
  },
});
