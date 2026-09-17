import { redirect } from "next/navigation";

/**
 * Entry point. /dashboard resolves the signed-in user's role and forwards them
 * to the right home screen (or to /login when signed out).
 */
export default function Home() {
  redirect("/dashboard");
}
