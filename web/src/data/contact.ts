// Public-site configuration, not a general RFC mailbox parser. Keep accepted
// addresses safe in every existing mailto path, including the no-JavaScript UI.
// Use a simple forwarding alias for quoted, international or URI-delimiter locals.
export function publicContactEmail(value: string): string {
  const email = value.trim();
  if (!/^[A-Z0-9._+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
    throw new Error('PUBLIC_CONTACT_EMAIL must be a simple ASCII mailbox without URI delimiters, percent escapes, headers or whitespace. Use a public forwarding alias for other formats.');
  }
  return email;
}
