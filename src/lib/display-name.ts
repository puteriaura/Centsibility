export interface UserMetadataLike {
  comfort_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface UserLike {
  user_metadata?: UserMetadataLike | null;
  email?: string | null;
}

/**
 * Derives parent display name following precedence:
 * 1. user_metadata.comfort_name (custom name set during onboarding/settings)
 * 2. user_metadata.display_name
 * 3. user_metadata.full_name
 * 4. user_metadata.name
 * 5. email username (part before @)
 * 6. "Parent"
 */
export function parentDisplayName(user: UserLike | null | undefined): string {
  if (!user) return "Parent";
  const meta = user.user_metadata;
  const comfortName = meta?.comfort_name?.trim();
  if (comfortName) return comfortName;

  const displayName = meta?.display_name?.trim();
  if (displayName) return displayName;

  const fullName = meta?.full_name?.trim();
  if (fullName) return fullName;

  const name = meta?.name?.trim();
  if (name) return name;

  if (user.email) {
    const beforeAt = user.email.split("@")[0]?.trim();
    if (beforeAt) return beforeAt;
  }

  return "Parent";
}
