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
const PASSWORD_HELPER =
  "At least 8 characters, one uppercase letter, one number.";

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
      <Card sx={{ maxWidth: 480, width: "100%", p: 2 }} elevation={1}>
        <CardContent sx={{ "&:last-child": { pb: 3 } }}>
          <Box sx={{ textAlign: "center", mb: 4 }} id="register-heading">
            <Typography component="h1" variant="h4" sx={{ fontWeight: 600, color: "primary.main" }}>
              ALM Manifest
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Create your account
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
              aria-labelledby="register-heading"
              aria-describedby={error ? ERROR_ALERT_ID : undefined}
            >
              <RhfTextField<RegisterFormData>
                name="display_name"
                label="Display Name"
                fullWidth
                sx={{ mb: 2.5 }}
                autoComplete="name"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for register form UX
                autoFocus
                disabled={isPending}
              />
              <RhfTextField<RegisterFormData>
                name="email"
                label="Email"
                type="email"
                fullWidth
                sx={{ mb: 2.5 }}
                autoComplete="email"
                disabled={isPending}
              />
              <RhfTextField<RegisterFormData>
                name="org_name"
                label="Organization Name"
                fullWidth
                sx={{ mb: 2.5 }}
                autoComplete="organization"
                disabled={isPending}
              />
              <RhfTextField<RegisterFormData>
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                sx={{ mb: 2.5 }}
                autoComplete="new-password"
                helperText={PASSWORD_HELPER}
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
              <RhfTextField<RegisterFormData>
                name="confirm_password"
                label="Confirm password"
                type={showConfirmPassword ? "text" : "password"}
                fullWidth
                sx={{ mb: 3 }}
                autoComplete="new-password"
                disabled={isPending}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          edge="end"
                          size="small"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          disabled={isPending}
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
                  "Create Account"
                )}
              </Button>
            </Box>
          </FormProvider>

          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2.5, mt: 1 }}>
            <Typography variant="body2" align="center" color="text.secondary">
              Already have an account?{" "}
              <Link component={RouterLink} to="/login" underline="hover">
                Sign In
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
