import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Alert,
  Link,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
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
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 440, width: "100%", p: 2 }} elevation={1}>
        <CardContent sx={{ "&:last-child": { pb: 3 } }}>
          <Box sx={{ textAlign: "center", mb: 4 }} id="login-heading">
            <Typography component="h1" variant="h4" sx={{ fontWeight: 600, color: "primary.main" }}>
              ALM Manifest
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Sign in to your account
            </Typography>
          </Box>

          {error && (
            <Alert
              id={ERROR_ALERT_ID}
              severity="error"
              role="alert"
              sx={{ mb: 3 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <FormProvider {...form}>
            <Box
              component="form"
              id={FORM_ID}
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              aria-labelledby="login-heading"
              aria-describedby={error ? ERROR_ALERT_ID : undefined}
            >
              <RhfTextField<LoginFormData>
                name="email"
                label="Email"
                type="email"
                fullWidth
                sx={{ mb: 2.5 }}
                autoComplete="email"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for login form UX
                autoFocus
                disabled={isPending}
              />
              <RhfTextField<LoginFormData>
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                sx={{ mb: 3 }}
                autoComplete="current-password"
                disabled={isPending}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          disabled={isPending}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isPending}
                sx={{ mb: 2, py: 1.5 }}
                aria-busy={isPending}
              >
                {isPending ? (
                  <CircularProgress size={24} color="inherit" aria-hidden />
                ) : (
                  "Sign In"
                )}
              </Button>
            </Box>
          </FormProvider>

          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2.5, mt: 1 }}>
            <Typography variant="body2" align="center" color="text.secondary">
              Don&apos;t have an account?{" "}
              <Link component={RouterLink} to="/register" underline="hover">
                Register
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
