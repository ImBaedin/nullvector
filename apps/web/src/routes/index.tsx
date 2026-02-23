import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }
    navigate({
      to: "/auth/complete",
      replace: true,
    });
  }, [isAuthenticated, isAuthLoading, navigate]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 p-2 backdrop-blur">
        {mode === "signIn" ? (
          <SignInForm onSwitchToSignUp={() => setMode("signUp")} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setMode("signIn")} />
        )}
      </div>
    </div>
  );
}
