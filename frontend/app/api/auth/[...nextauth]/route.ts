import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "setup-in-env",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "setup-in-env",
    }),
    CredentialsProvider({
      name: "Account",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch("http://localhost:3001/api/auth/verify-password-login", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, password: credentials.password })
          });
          const data = await res.json();
          if (res.ok && data.user) {
            return { id: data.user.id, email: data.user.email, name: data.user.name, role: data.user.role };
          }
          return null;
        } catch (error) { return null; }
      }
    })
  ],
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 🔥 30 Days Session Length!
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const res = await fetch("http://localhost:3001/api/auth/google-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, name: user.name, image: user.image })
          });
          const data = await res.json();
          if (res.ok && data.user) {
            user.id = data.user.id;
            (user as any).role = data.user.role;
            return true;
          }
          return false;
        } catch(e) { return false; }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role || "BIDDER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: { signIn: '/login' }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };