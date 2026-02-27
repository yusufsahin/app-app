import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, Button } from "../../../shared/components/ui";
import { RhfTextField } from "../../../shared/components/forms";
import { useLogin } from "../../../shared/api/authApi";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useTenantStore } from "../../../shared/stores/tenantStore";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const ERROR_ALERT_ID = "login-error";
const FORM_ID = "login-form";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setTenant = useTenantStore((s) => s.setTenant);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  const { handleSubmit } = form;

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      const result = await login.mutateAsync(data);

      if (result.requires_tenant_selection && result.tenants && result.temp_token) {
        navigate("/select-tenant", {
          state: { tempToken: result.temp_token, tenants: result.tenants },
        });
      } else if (result.access_token && result.refresh_token) {
        setTokens(result.access_token, result.refresh_token);
        if (result.tenants?.length === 1) {
          setTenant(result.tenants[0]!);
        }
        navigate("/");
      }
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      setError(problem.detail ?? problem.message ?? "Login failed. Please try again.");
    }
  };

  const isPending = login.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[440px] p-6">
        <CardContent className="space-y-6 pb-6">
          <div className="text-center" id="login-heading">
            <h1 className="text-2xl font-semibold text-primary">ALM Manifest</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
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
              aria-labelledby="login-heading"
              aria-describedby={error ? ERROR_ALERT_ID : undefined}
              className="space-y-4"
            >
              <RhfTextField<LoginFormData>
                name="email"
                label="Email"
                type="email"
                fullWidth
                autoComplete="email"
                autoFocus
                disabled={isPending}
              />
              <RhfTextField<LoginFormData>
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                autoComplete="current-password"
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

              <Button
                type="submit"
                className="w-full py-6"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </FormProvider>

          <div className="border-t border-border pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-primary underline-offset-4 hover:underline">
                Register
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
