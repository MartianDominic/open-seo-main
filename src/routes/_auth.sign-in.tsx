import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  AuthPageCard,
  authRedirectSearchSchema,
  getFieldError,
  getFormError,
  useAuthPageState,
} from "@/client/features/auth/AuthPage";
import { captureClientEvent } from "@/client/lib/posthog";
import { authClient } from "@/lib/auth-client";
import { getSignInSearch } from "@/lib/auth-redirect";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const Route = createFileRoute("/_auth/sign-in")({
  validateSearch: authRedirectSearchSchema,
  component: SignInPage,
});

function SignInPage() {
  const search = Route.useSearch();
  const { redirectTo, isHostedMode } = useAuthPageState(search.redirect);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        const email = value.email.trim();
        captureClientEvent("auth:sign_in_submit", {
          redirect_to: redirectTo,
        });
        setVerificationEmail(null);

        const result = await authClient.signIn.email({
          email,
          password: value.password,
          callbackURL: redirectTo,
        });

        if (!result.error) {
          captureClientEvent("auth:sign_in_success", {
            redirect_to: redirectTo,
          });
          return;
        }

        if (result.error.status === 403) {
          captureClientEvent("auth:sign_in_block_unverified", {
            redirect_to: redirectTo,
          });
          setVerificationEmail(email);
          formApi.setErrorMap({
            onSubmit: {
              form: "Please confirm your email before signing in.",
              fields: {},
            },
          });
          return;
        }

        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message || "We couldn't sign you in.",
            fields: {},
          },
        });
      } catch {
        formApi.setErrorMap({
          onSubmit: {
            form: "Unable to sign in right now. Please try again.",
            fields: {},
          },
        });
      }
    },
  });

  async function handleResendVerification() {
    if (!verificationEmail) {
      return;
    }

    setIsSendingVerification(true);

    try {
      const callbackURL = new URL("/verify-email", window.location.origin);
      if (redirectTo !== "/")
        callbackURL.searchParams.set("redirect", redirectTo);
      const result = await authClient.sendVerificationEmail({
        email: verificationEmail,
        callbackURL: callbackURL.toString(),
      });

      if (result.error) {
        toast.error(result.error.message || "We couldn't send another email.");
        return;
      }

      captureClientEvent("auth:verification_resend");
      toast.success("A new email is on the way.");
    } catch {
      toast.error(
        "We couldn't send another email right now. Please try again.",
      );
    } finally {
      setIsSendingVerification(false);
    }
  }

  return (
    <AuthPageCard
      title="Sign in"
      footer={
        isHostedMode ? (
          <div className="flex justify-between text-sm text-muted-foreground">
            <Link
              to="/forgot-password"
              search={getSignInSearch(redirectTo)}
              className="text-foreground underline underline-offset-2 hover:text-foreground/80 transition-colors"
            >
              Forgot password?
            </Link>
            <Link
              to="/sign-up"
              search={getSignInSearch(redirectTo)}
              className="text-foreground underline underline-offset-2 hover:text-foreground/80 transition-colors"
            >
              Create account
            </Link>
          </div>
        ) : null
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => {
            const error = getFieldError(field.state.meta.errors);

            return (
              <div>
                <Input
                  type="email"
                  className="w-full"
                  placeholder="Email address..."
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  autoComplete="email"
                  disabled={!isHostedMode}
                  required
                />
                {error ? (
                  <p className="mt-1 text-sm text-destructive">{error}</p>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const error = getFieldError(field.state.meta.errors);

            return (
              <div>
                <Input
                  type="password"
                  className="w-full"
                  placeholder="Password..."
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  autoComplete="current-password"
                  disabled={!isHostedMode}
                  required
                />
                {error ? (
                  <p className="mt-1 text-sm text-destructive">{error}</p>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        {verificationEmail ? (
          <div className="alert alert-warning items-start">
            <div className="space-y-3">
              <p className="text-sm">
                Please check {verificationEmail} for a link to confirm your
                email.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleResendVerification();
                }}
                disabled={isSendingVerification}
              >
                {isSendingVerification
                  ? "Sending email..."
                  : "Send another email"}
              </Button>
            </div>
          </div>
        ) : null}

        <form.Subscribe
          selector={(state) => ({
            submitError: state.errorMap.onSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ submitError, isSubmitting }) => {
            const errorMessage = getFormError(submitError);
            return (
              <>
                {errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : null}
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!isHostedMode || isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </>
            );
          }}
        </form.Subscribe>
      </form>
    </AuthPageCard>
  );
}
