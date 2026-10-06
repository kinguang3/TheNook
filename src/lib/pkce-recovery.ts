export const NOOK_PKCE_COOKIE = "nook-pkce-recovery";

const SUPABASE_HOST = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
).hostname;
const STORAGE_KEY = `sb-${SUPABASE_HOST.split(".")[0]}-auth-token`;
export const LEGACY_VERIFIER_COOKIE = `${STORAGE_KEY}-code-verifier`;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateRecoveryVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function recoveryChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64Url(new Uint8Array(digest));
}
