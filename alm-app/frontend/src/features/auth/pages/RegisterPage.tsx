import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, Button } from "../../../shared/components/ui";
import { RhfTextField } from "../../../shared/components/forms";
import { useRegister } from "../../../shared/api/authApi";
import { useAuthStore } from "../../../shared/stores/authStore";

const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirm_password: z.string(),
    display_name: z.string().min(2, "Display name must be at least 2 characters"),
    org_name: z.string().min(2, "Organization name must be at least 2 characters"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const ERROR_ALERT_ID = "register-error";
const FORM_ID = "register-form";
const PASSWORD_HELPER = "At least 8 characters, one uppercase letter, one number.";

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });
  const { handleSubmit } = form;

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    try {
      const { confirm_password: _, ...payload } = data;
      const result = await registerMutation.mutateAsync(payload);
      setTokens(result.access_token, result.refresh_token);
      navigate("/");
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      setError(problem.detail ?? problem.message ?? "Registration failed. Please try again.");
    }
  };

  const isPending = registerMutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[480px] p-6">
        <CardContent className="space-y-6 pb-6">
          <div className="text-center" id="register-heading">
            <h1 className="text-2xl font-semibold text-primary">ALM Manifest</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create your account</p>
          </div>

          {error && (
            <div
              id={ERROR_ALERT_ID}
              role="alert"
              className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded p-1 hover:bg-destructive/20"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <FormProvider {...form}>
            <form
              id={FORM_ID}
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              aria-labelledby="register-heading"
              aria-describedby={error ? ERROR_ALERT_ID : undefined}
              className="space-y-4"
            >
              <RhfTextField<RegisterFormData>
                name="display_name"
                label="Display Name"
                fullWidth
                autoComplete="name"
                autoFocus
                disabled={isPending}
              />
              <RhfTextField<RegisterFormData>
                name="email"
                label="Email"
                type="email"
                fullWidth
                autoComplete="email"
                disabled={isPending}
              />
              <RhfTextField<RegisterFormData>
                name="org_name"
                label="Organization Name"
                fullWidth
                autoComplete="organization"
                disabled={isPending}
              />
              <RhfTextField<RegisterFormData>
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                autoComplete="new-password"
                helperText={PASSWORD_HELPER}
                disabled={isPending}
                slotProps={{
                  input: {
                    endAdornment: (
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={isPending}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    ),
                  },
                }}
              />
              <RhfTextField<RegisterFormData>
                name="confirm_password"
                label="Confirm password"
                type={showConfirmPassword ? "text" : "password"}
                fullWidth
                autoComplete="new-password"
                disabled={isPending}
                slotProps={{
                  input: {
                    endAdornment: (
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        disabled={isPending}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                className="w-full py-6"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </FormProvider>

          <div className="border-t border-border pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
