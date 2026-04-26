"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";

export default function AccessDeniedPage() {
  const { session, clearSession } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.push("/home");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">Access Denied</h1>
      <p className="max-w-md text-gray-400">
        AutoGM is currently in closed beta. Your account{" "}
        {session?.user_id && (
          <>
            (<span className="font-mono text-gray-300">{session.user_id}</span>)
          </>
        )}{" "}
        is not on the access list.
      </p>
      <p className="text-gray-500 text-sm">
        Contact the developer to request access.
      </p>
      <button
        onClick={handleLogout}
        className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600"
      >
        Sign out
      </button>
    </main>
  );
}
