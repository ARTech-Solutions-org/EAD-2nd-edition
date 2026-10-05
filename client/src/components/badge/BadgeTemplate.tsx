import type { EadRegistration } from "../../../../shared/ead";
import type { Language } from "../../i18n/EadLanguage";

const FRONT_ART = "/assets/ead-badge-front.jpg";
const BACK_ART = "/assets/ead-badge-back.jpg";

type BadgeAttendee = Pick<EadRegistration, "registrationId" | "name" | "company" | "title" | "email" | "language">;
export type BadgeFace = "front" | "back";

export function BadgeTemplate({ attendee, face, language }: { attendee: BadgeAttendee; face: BadgeFace; language?: Language }) {
  const selectedLanguage = language ?? attendee.language;
  const faceName = face === "front"
    ? selectedLanguage === "ar" ? "الوجه الأمامي" : "Front"
    : selectedLanguage === "ar" ? "الوجه الخلفي" : "Back";

  return (
    <div
      className={`badge-card badge-${face}`}
      dir={selectedLanguage === "ar" ? "rtl" : "ltr"}
      role="img"
      aria-label={`${faceName} · ${attendee.name} · ${attendee.company}`}
    >
      <img
        className="badge-art"
        src={face === "front" ? FRONT_ART : BACK_ART}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {face === "front" && (
        <div className="badge-attendee-panel">
          <div className="badge-attendee-name">{attendee.name || (selectedLanguage === "ar" ? "اسم الحاضر" : "Attendee name")}</div>
          <div className="badge-attendee-company">{attendee.company || (selectedLanguage === "ar" ? "الشركة" : "Company")}</div>
          {attendee.title && <div className="badge-attendee-title">{attendee.title}</div>}
          <div className="badge-attendee-id">{attendee.registrationId}</div>
        </div>
      )}
      <span className="sr-only">{attendee.title} · {attendee.email}</span>
    </div>
  );
}

export function BadgePair({ attendee, language }: { attendee: BadgeAttendee; language?: Language }) {
  const selectedLanguage = language ?? attendee.language;
  return (
    <div className="print-pair" aria-label={selectedLanguage === "ar" ? "طباعة وجهي الشارة" : "Print both sides of the badge"}>
      <div className="print-sheet print-sheet-front">
        <BadgeTemplate attendee={attendee} face="front" language={selectedLanguage} />
      </div>
      <div className="print-sheet print-sheet-back">
        <BadgeTemplate attendee={attendee} face="back" language={selectedLanguage} />
      </div>
    </div>
  );
}
