export const PASSWORD_RULES = [
  { message: "Use at least 8 characters.", test: (value: string) => value.length >= 8 },
  { message: "Include an uppercase letter (A–Z).", test: (value: string) => /[A-Z]/.test(value) },
  { message: "Include a lowercase letter (a–z).", test: (value: string) => /[a-z]/.test(value) },
  { message: "Include a number (0–9).", test: (value: string) => /[0-9]/.test(value) },
  { message: "Include a symbol, such as !, @, or #.", test: (value: string) => /[^a-zA-Z0-9\s]/.test(value) },
];

export function passwordError(password: string, confirmation: string): string {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password));
  return missing.length ? missing.map((rule) => rule.message).join(" ")
    : password !== confirmation ? "Passwords do not match. Enter the same password in both fields." : "";
}
