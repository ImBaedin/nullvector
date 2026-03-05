import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@nullvector/backend/convex/_generated/api";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/complete")({
  component: AuthCompleteRoute,
});

function AuthCompleteRoute() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { data: betterAuthSession, isPending: isBetterAuthPending } =
    authClient.useSession();
  const ensureSession = useMutation(api.session.ensureSession);
  const inFlightRef = useRef(false);
  const firstSeenAtRef = useRef<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const hasBetterAuthSession = Boolean(betterAuthSession?.session);

  useEffect(() => {
    if (isBetterAuthPending || isAuthLoading) {
      return;
    }

    if (hasBetterAuthSession) {
      firstSeenAtRef.current = null;
      return;
    }

    if (firstSeenAtRef.current === null) {
      firstSeenAtRef.current = Date.now();
      return;
    }

    if (Date.now() - firstSeenAtRef.current < 2_000) {
      return;
    }

    if (!hasBetterAuthSession) {
      navigate({
        to: "/",
        replace: true,
      });
      return;
    }
  }, [hasBetterAuthSession, isAuthLoading, isBetterAuthPending, navigate, retryNonce]);

  useEffect(() => {
    if (isBetterAuthPending || isAuthLoading) {
      return;
    }

    if (!hasBetterAuthSession || isAuthenticated) {
      return;
    }

    let cancelled = false;
    const start = Date.now();

    const resync = async () => {
      if (cancelled || isAuthenticated) {
        return;
      }
      await authClient.getSession();
      (authClient as unknown as { updateSession?: () => void }).updateSession?.();
      if (Date.now() - start > 8_000 && !cancelled && !isAuthenticated) {
        setErrorMessage(
          "Auth session is taking longer than expected to initialize. Retry or sign out."
        );
      }
    };

    void resync();
    const interval = window.setInterval(() => {
      void resync();
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    hasBetterAuthSession,
    isAuthenticated,
    isAuthLoading,
    isBetterAuthPending,
    retryNonce,
  ]);

  useEffect(() => {
    if (isBetterAuthPending || isAuthLoading) {
      return;
    }

    if (!hasBetterAuthSession) {
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setErrorMessage(null);

    (async () => {
      const attempts = 30;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (!isAuthenticated) {
          await authClient.getSession();
          (authClient as unknown as { updateSession?: () => void }).updateSession?.();
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        try {
          const result = await ensureSession({});
          navigate({
            to: "/game/colony/$colonyId/resources",
            params: { colonyId: result.defaultColonyId },
            replace: true,
          });
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const isAuthDelay = message.includes("Authentication required");
          if (!isAuthDelay || attempt === attempts - 1) {
            throw error;
          }
          await authClient.getSession();
          (authClient as unknown as { updateSession?: () => void }).updateSession?.();
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      throw new Error("Timed out while waiting for authenticated Convex session");
    })()
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to initialize your colony session";
        setErrorMessage(message);
        toast.error(message);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [
    ensureSession,
    hasBetterAuthSession,
    isAuthenticated,
    isAuthLoading,
    isBetterAuthPending,
    navigate,
    retryNonce,
  ]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl items-center justify-center px-4 py-8 text-white/80">
      {errorMessage ? (
        <div className="rounded-lg border border-red-400/40 bg-red-950/30 p-4 text-center">
          <p className="mb-3 text-sm text-red-100">{errorMessage}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              className="rounded border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
              onClick={() => setRetryNonce((value) => value + 1)}
              type="button"
            >
              Retry
            </button>
            <button
              className="rounded border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
              onClick={() => {
                authClient.signOut();
                navigate({
                  to: "/",
                  replace: true,
                });
              }}
              type="button"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        "Finalizing your colony session..."
      )}
    </div>
  );
}
