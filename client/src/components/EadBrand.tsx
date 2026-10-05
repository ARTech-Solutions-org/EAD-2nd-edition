import { LanguageSwitch } from "../i18n/EadLanguage";

const WORDMARK = "/assets/ead-wordmark.png";
const MONOGRAM = "/assets/ead-monogram.jpg";

export function EadWordmark({ compact = false }: { compact?: boolean }) {
  if (compact) return <img className="ead-monogram" src={MONOGRAM} alt="EAD" />;
  return <img className="ead-wordmark" src={WORDMARK} alt="Egypt Arbitration Days" />;
}

export function DeskUtility({ staffHref = "/admin" }: { staffHref?: string }) {
  return (
    <div className="desk-utility">
      <LanguageSwitch />
      <a className="staff-access-link" href={staffHref}>Staff access <span aria-hidden="true">↗</span></a>
    </div>
  );
}
