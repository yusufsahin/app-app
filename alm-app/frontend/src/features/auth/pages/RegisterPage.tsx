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

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  display_name: z.string().min(2, "Display name must be at least 2 characters"),
  org_name: z.string().min(2, "Organization name must be at least 2 characters"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });
  const { handleSubmit } = form;

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    try {
      const result = await registerMutation.mutateAsync(data);
      setTokens(result.access_token, result.refresh_token);
      navigate("/");
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      setError(problem.detail ?? problem.message ?? "Registration failed. Please try again.");
    }
  };

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
      <Card sx={{ maxWidth: 480, width: "100%", p: 2 }}>
        <CardContent>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 600, color: "primary.main" }}>
              ALM Manifest
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Create your account
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <FormProvider {...form}>
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <RhfTextField<RegisterFormData>
                name="display_name"
                label="Display Name"
                fullWidth
                sx={{ mb: 2.5 }}
              />
              <RhfTextField<RegisterFormData>
                name="email"
                label="Email"
                type="email"
                fullWidth
                sx={{ mb: 2.5 }}
                autoComplete="email"
              />
              <RhfTextField<RegisterFormData>
                name="org_name"
                label="Organization Name"
                fullWidth
                sx={{ mb: 2.5 }}
              />
              <RhfTextField<RegisterFormData>
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                sx={{ mb: 3 }}
                autoComplete="new-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                          aria-label="toggle password visibility"
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
                disabled={registerMutation.isPending}
                sx={{ mb: 2, py: 1.5 }}
              >
              {registerMutation.isPending ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Create Account"
              )}
            </Button>
            </Box>
          </FormProvider>

          <Typography variant="body2" align="center" color="text.secondary">
            Already have an account?{" "}
            <Link component={RouterLink} to="/login" underline="hover">
              Sign In
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
