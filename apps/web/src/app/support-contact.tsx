// Show the configured support address, or say plainly that none is published yet.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/** Renders the contact line shared by the privacy and about pages. */
export function SupportContact() {
  return SUPPORT_EMAIL
    ? <p>Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for privacy questions, account help, or to report an error in a record.</p>
    : <p>A support address will be published here before public launch. Until then, account holders can export or delete their data from account settings.</p>;
}
