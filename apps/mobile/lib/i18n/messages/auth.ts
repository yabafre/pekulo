// apps/mobile/lib/i18n/messages/auth.ts
import type { Shape } from "../types";

export const fr = {
  title: "Connexion",
  subtitle: "Synchronisez votre cap et vos comptes Pekulo",
  email: "Adresse e-mail",
  password: "Mot de passe",
  passwordPlaceholder: "12 caractères minimum",
  submitting: "Connexion…",
  continuePreview: "Continuer en mode aperçu",
  privacyPolicy: "Politique de confidentialité",
  terms: "Conditions d’utilisation",
  support: "Assistance",
  errors: {
    generic: "Impossible de se connecter.",
    emailInvalid: "Veuillez saisir une adresse e-mail valide.",
    passwordTooShort: "Le mot de passe doit contenir au moins 12 caractères.",
    invalidCredentials: "Identifiants invalides.",
  },
} as const;

export const en: Shape<typeof fr> = {
  title: "Sign in",
  subtitle: "Sync your cap and your Pekulo accounts",
  email: "Email",
  password: "Password",
  passwordPlaceholder: "At least 12 characters",
  submitting: "Signing in…",
  continuePreview: "Continue in preview mode",
  privacyPolicy: "Privacy Policy",
  terms: "Terms of Service",
  support: "Support",
  errors: {
    generic: "Sign-in failed. Please try again.",
    emailInvalid: "Please enter a valid email address.",
    passwordTooShort: "Your password must be at least 12 characters.",
    invalidCredentials: "Incorrect email or password.",
  },
};
