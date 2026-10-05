import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { BadgePair, BadgeTemplate, type BadgeFace } from "../components/badge/BadgeTemplate";
import { DeskUtility, EadWordmark } from "../components/EadBrand";
import { LanguageSwitch, useLanguage } from "../i18n/EadLanguage";
import type { EadRegistration, RegistrationInput } from "../../../shared/ead";
import { trpc } from "../lib/trpc";

const emptyForm = (language: "en" | "ar"): RegistrationInput => ({ name: "", company: "", title: "", email: "", language });
type CreatedRegistration = EadRegistration & { printToken: string };
type FieldName = "name" | "company" | "title" | "email";

type FormErrors = Partial<Record<FieldName, string>>;

export default function Home() {
  const { language, t } = useLanguage();
  const [, setLocation] = useLocation();
  const firstField = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<RegistrationInput>(() => emptyForm(language));
  const [errors, setErrors] = useState<FormErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [attendee, setAttendee] = useState<CreatedRegistration | null>(null);
  const [face, setFace] = useState<BadgeFace>("front");
  const [zoom, setZoom] = useState(1);
  const [printed, setPrinted] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);
  const [fastMode, setFastMode] = useState(true);
  const [printStarted, setPrintStarted] = useState(false);
  const [printPendingConfirmation, setPrintPendingConfirmation] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, language }));
  }, [language]);

  useEffect(() => {
    firstField.current?.focus({ preventScroll: true });
    const returnPath = window.sessionStorage.getItem("ead-admin-return");
    if (returnPath?.startsWith("/admin")) {
      window.sessionStorage.removeItem("ead-admin-return");
      setLocation(returnPath);
    }
  }, [setLocation]);

  const markPrinted = trpc.registration.markPrinted.useMutation();

  const createRegistration = trpc.registration.create.useMutation({
    onSuccess: (created) => {
      setAttendee(created);
      setFace("front");
      setZoom(1);
      setDuplicate(false);
      setErrorMessage("");
      setErrors({});
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        setDuplicate(true);
        setErrorMessage("");
        return;
      }
      setErrorMessage(!navigator.onLine || /network|fetch|connection/i.test(error.message) ? t("networkError") : t("genericError"));
    },
  });

  const validate = () => {
    const next: FormErrors = {};
    if (form.name.trim().length < 2) next.name = t("validationName");
    if (form.company.trim().length < 2) next.company = t("validationCompany");
    if (form.title.trim().length < 2) next.title = t("validationTitle");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t("validationEmail");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDuplicate(false);
    setErrorMessage("");
    if (!validate()) return;
    createRegistration.mutate({ ...form, name: form.name.trim(), company: form.company.trim(), title: form.title.trim(), email: form.email.trim().toLowerCase(), language });
  };

  const resetForNext = useCallback(() => {
    setAttendee(null);
    setForm(emptyForm(language));
    setErrors({});
    setDuplicate(false);
    setErrorMessage("");
    setPrinted(false);
    setPrintedAt(null);
    setPrintStarted(false);
    setPrintPendingConfirmation(false);
    window.setTimeout(() => firstField.current?.focus({ preventScroll: true }), 30);
  }, [language]);

  const handlePrint = useCallback(() => {
    if (!attendee || printStarted) return;
    setPrintStarted(true);
    setPrintPendingConfirmation(false);
    const afterPrint = () => {
      setPrintStarted(false);
      setPrintPendingConfirmation(true);
      window.removeEventListener("afterprint", afterPrint);
    };
    window.addEventListener("afterprint", afterPrint, { once: true });
    window.print();
  }, [attendee, printStarted]);

  const confirmPrinted = useCallback(() => {
    if (!attendee || !printPendingConfirmation || markPrinted.isPending) return;
    markPrinted.mutate({ id: attendee.id, printToken: attendee.printToken }, {
      onSuccess: () => {
        const time = new Date();
        setPrinted(true);
        setPrintedAt(time);
        setPrintPendingConfirmation(false);
        toast.success(t("badgePrinted"));
        if (fastMode) window.setTimeout(resetForNext, 1400);
      },
      onError: () => toast.error(t("genericError")),
    });
  }, [attendee, fastMode, markPrinted, printPendingConfirmation, resetForNext, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        resetForNext();
      }
      if (event.key.toLowerCase() === "p" && attendee) {
        event.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attendee, handlePrint, resetForNext]);

  const openExisting = () => {
    const query = encodeURIComponent(form.email.trim());
    setLocation(`/admin/registrations?search=${query}`);
  };

  return (
    <main className="registration-shell">
      <aside className="event-panel">
        <div className="event-panel-top">
          <EadWordmark />
          <span className="panel-kicker">{t("checkIn")}</span>
        </div>
        <div className="event-panel-copy">
          <div className="event-edition">{t("eventEdition")}</div>
          <h1>{language === "ar" ? "أيام التحكيم المصرية" : "Egypt Arbitration Days"}<span>2026</span></h1>
          <div className="event-date-lockup"><span className="date-rule" />{t("eventDate")}</div>
          <p>{t("eventNote")}</p>
        </div>
        <div className="event-geometry" aria-hidden="true">
          <span className="geo-square geo-one" /><span className="geo-square geo-two" />
          <span className="geo-square geo-three" /><span className="geo-line" />
        </div>
        <div className="panel-footer"><span>{t("cityLine")}</span><span>{t("dateFooter")}</span></div>
      </aside>

      <section className="desk-main">
        <header className="desk-header">
          <div className="mobile-brand"><EadWordmark compact /><span>EAD <b>2026</b></span></div>
          <div className="desk-utility"><LanguageSwitch /><a className="staff-access-link" href="/admin">{t("staffAccess")} <span aria-hidden="true">↗</span></a></div>
        </header>

        {!attendee ? (
          <div className="registration-content">
            <div className="step-label"><span className="step-dot" />{t("checkIn")}</div>
            <h2 className="registration-heading">{t("registrationTitle")}</h2>
            <p className="registration-intro">{t("registrationIntro")}</p>

            {duplicate ? (
              <div className="duplicate-card" role="alert">
                <span className="duplicate-mark">!</span>
                <div><h3>{t("duplicateTitle")}</h3><p>{t("duplicateMessage")}</p></div>
                <div className="duplicate-actions">
                  <button type="button" className="button button-primary" onClick={openExisting}>{t("viewRegistration")}</button>
                  <button type="button" className="button button-text" onClick={resetForNext}>{t("registerAnotherPerson")}</button>
                </div>
              </div>
            ) : (
              <form className="registration-form" onSubmit={submit} noValidate>
                <div className="form-grid">
                  <Field label={t("name")} placeholder={t("namePlaceholder")} value={form.name} error={errors.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} inputRef={firstField} autoComplete="name" required />
                  <Field label={t("company")} placeholder={t("companyPlaceholder")} value={form.company} error={errors.company} onChange={(value) => setForm((prev) => ({ ...prev, company: value }))} autoComplete="organization" required />
                  <Field label={t("title")} placeholder={t("titlePlaceholder")} value={form.title} error={errors.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} autoComplete="organization-title" required />
                  <Field label={t("email")} placeholder={t("emailPlaceholder")} value={form.email} error={errors.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} type="email" autoComplete="email" required />
                </div>
                {errorMessage && <p className="form-error-banner" role="alert">{errorMessage}</p>}
                <div className="form-submit-row">
                  <button className="button button-primary button-large" type="submit" disabled={createRegistration.isPending}>
                    {createRegistration.isPending ? <><span className="spinner" />{t("processing")}</> : <>{t("completeRegistration")}<span aria-hidden="true">{language === "ar" ? "←" : "→"}</span></>}
                  </button>
                  <label className="fast-toggle"><input type="checkbox" checked={fastMode} onChange={(event) => setFastMode(event.target.checked)} /><span className="toggle-track" /><span>{t("fastMode")}</span></label>
                </div>
                <p className="privacy-line"><span className="lock-mark" aria-hidden="true">⌑</span>{t("secure")}</p>
              </form>
            )}
          </div>
        ) : (
          <div className="confirmation-content" aria-live="polite">
            <div className="confirmation-topline"><span className="success-seal">✓</span><div><div className="step-label">{t("registrationComplete")}</div><p>{t("welcome")}</p></div></div>
            {printed ? <div className="print-success-banner"><span>✓</span><div><strong>{t("badgePrinted")}</strong><p>{t("printedAt")}: {new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(printedAt ?? new Date())}</p></div></div> : null}
            {printPendingConfirmation && <div className="print-confirm-banner" role="status"><div><strong>{t("printDialogClosed")}</strong><p>{t("physicalCheck")}</p></div><div className="print-confirm-actions"><button className="button button-primary" type="button" onClick={confirmPrinted} disabled={markPrinted.isPending}>{markPrinted.isPending ? t("processing") : t("confirmPrinted")}</button><button className="button button-text" type="button" onClick={handlePrint}>{t("printAgain")}</button></div></div>}
            <div className="confirmation-layout">
              <div className="attendee-summary">
                <div className="section-overline">{t("attendeeSummary")}</div>
                <h2>{attendee.name}</h2>
                <dl>
                  <div><dt>{t("company")}</dt><dd>{attendee.company}</dd></div>
                  <div><dt>{t("title")}</dt><dd>{attendee.title}</dd></div>
                  <div><dt>{t("email")}</dt><dd>{attendee.email}</dd></div>
                  <div><dt>{t("registrationId")}</dt><dd className="registration-id">{attendee.registrationId}</dd></div>
                </dl>
                <label className="fast-toggle success-fast-toggle"><input type="checkbox" checked={fastMode} onChange={(event) => setFastMode(event.target.checked)} /><span className="toggle-track" /><span>{t("fastModeHint")}</span></label>
              </div>
              <div className="badge-ready-card">
                <div className="badge-card-head"><div><span className="ready-indicator" />{t("badgeReady")}</div><span className="badge-size-label">74 × 105 mm</span></div>
                <div className="badge-preview-stage">
                  <div style={{ transform: `scale(${zoom})`, transition: "transform 180ms ease" }}><BadgeTemplate attendee={attendee} face={face} language={language} /></div>
                </div>
                <div className="badge-tools-row">
                  <div className="face-switch" role="group" aria-label={t("badgeFace")}>
                    <button className={face === "front" ? "active" : ""} type="button" onClick={() => setFace("front")}>{t("front")}</button>
                    <button className={face === "back" ? "active" : ""} type="button" onClick={() => setFace("back")}>{t("back")}</button>
                  </div>
                  <label className="zoom-control"><span className="sr-only">{t("zoom")}</span><span aria-hidden="true">−</span><input type="range" min="0.8" max="1.25" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span aria-hidden="true">+</span></label>
                </div>
                <div className="badge-print-copy">{t("printTwoSides")}</div>
              </div>
            </div>
            <div className="confirmation-actions">
              <button className="button button-primary button-large" type="button" onClick={handlePrint} disabled={printStarted}>
                {printStarted ? <><span className="spinner" />{t("processing")}</> : <>{printed ? t("reprint") : t("printBadge")} <span aria-hidden="true">⌘P</span></>}
              </button>
              <button className="button button-secondary" type="button" onClick={resetForNext}>{t("registerAnother")}</button>
            </div>
          </div>
        )}

        <footer className="desk-bottom"><span>{t("eventFooter")}</span><span>{t("registrationDeskFooter")}</span></footer>
      </section>
      {attendee && <div className="print-root"><BadgePair attendee={attendee} language={language} /></div>}
    </main>
  );
}

function Field({ label, placeholder, value, error, onChange, inputRef, type = "text", autoComplete, required = false }: { label: string; placeholder: string; value: string; error?: string; onChange: (value: string) => void; inputRef?: React.RefObject<HTMLInputElement | null>; type?: string; autoComplete?: string; required?: boolean }) {
  const { t } = useLanguage();
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`field-wrap ${error ? "has-error" : ""}`}>
          <label htmlFor={id}>{label}<span className="required-mark" aria-label={t("required")}>*</span></label>
      <input id={id} ref={inputRef} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} required={required} />
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}
