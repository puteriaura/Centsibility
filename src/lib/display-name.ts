export interface UserMetadataLike {
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
 * 1. user_metadata.display_name
 * 2. user_metadata.full_name
 * 3. user_metadata.name
 * 4. email username (part before @)
 * 5. "Parent"
 */
export function parentDisplayName(user: UserLike | null | undefined): string {
  if (!user) return "Parent";
  const meta = user.user_metadata;
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
