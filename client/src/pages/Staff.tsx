import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { BadgePair, BadgeTemplate } from "../components/badge/BadgeTemplate";
import { EadWordmark } from "../components/EadBrand";
import { LanguageSwitch, useLanguage } from "../i18n/EadLanguage";
import type { EadLanguage, EadRegistration } from "../../../shared/ead";
import { trpc } from "../lib/trpc";

const REFERENCE_ART = "/assets/ead-reference.jpg";
const LANYARD_ART = "/assets/ead-lanyard-strip.jpg";

type RegistrationForm = Pick<EadRegistration, "name" | "company" | "title" | "email" | "language">;
const initialRegistrationForm = (record: EadRegistration): RegistrationForm => ({
  name: record.name,
  company: record.company,
  title: record.title,
  email: record.email,
  language: record.language,
});

type PrintPhase = "preview" | "printing" | "confirm" | null;

export default function Staff() {
  const { t, language } = useLanguage();
  const [, setPath] = useLocation();
  const utils = trpc.useUtils();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const [printTarget, setPrintTarget] = useState<EadRegistration | null>(null);
  const [printPhase, setPrintPhase] = useState<PrintPhase>(null);
  const [printStarted, setPrintStarted] = useState(false);
  const [printSuccess, setPrintSuccess] = useState<{ record: EadRegistration; time: Date } | null>(null);
  const adminPrint = trpc.registration.adminPrint.useMutation();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { void utils.auth.me.invalidate(); setPath("/"); } });

  const startPrint = (record: EadRegistration) => {
    setPrintTarget(record);
    setPrintPhase("preview");
  };

  const openBrowserPrint = () => {
    if (!printTarget || printStarted) return;
    setPrintStarted(true);
    setPrintPhase("printing");
    const afterPrint = () => {
      setPrintStarted(false);
      confirmStaffPrint();
    };
    window.addEventListener("afterprint", afterPrint, { once: true });
    window.setTimeout(() => window.print(), 80);
  };

  const confirmStaffPrint = () => {
    if (!printTarget || adminPrint.isPending) return;
    adminPrint.mutate({ id: printTarget.id }, {
      onSuccess: async () => {
        await Promise.all([
          utils.registration.list.invalidate(),
          utils.registration.pending.invalidate({ limit: 100 }),
          utils.registration.stats.invalidate(),
          utils.registration.byId.invalidate({ id: printTarget.id }),
        ]);
        toast.success(t("badgePrinted"));
        setPrintSuccess({ record: printTarget, time: new Date() });
        setPrintTarget(null);
        setPrintPhase(null);
      },
      onError: () => toast.error(t("genericError")),
    });
  };

  const closePrintPreview = () => {
    setPrintTarget(null);
    setPrintPhase(null);
    setPrintStarted(false);
  };

  if (auth.isLoading) return <div className="admin-loading"><span className="spinner" />{t("checkingAccess")}</div>;
  if (!auth.data) return <StaffLogin />;
  if (auth.data.role !== "admin") return <AccessDenied onSignOut={() => logout.mutate()} />;

  const pathname = window.location.pathname;
  const detailMatch = pathname.match(/^\/admin\/registrations\/(\d+)\/?$/);
  const active = detailMatch ? "registrations" : pathname.includes("/badges") ? "badges" : pathname.includes("/settings") ? "settings" : pathname.includes("/registrations") ? "registrations" : "dashboard";
  const title = active === "dashboard" ? t("overview") : active === "registrations" ? t("registrations") : active === "badges" ? t("badgePrinting") : t("settings");

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand"><EadWordmark compact /><span><strong>EAD</strong><small>2026 · {t("staffLabel")}</small></span></Link>
        <div className="admin-sidebar-rule" />
        <div className="admin-nav-caption">{t("eventOperations")}</div>
        <nav className="admin-nav" aria-label={t("eventOperations")}>
          <NavItem href="/admin" active={active === "dashboard"} label={t("dashboard")} icon="⌂" />
          <NavItem href="/admin/registrations" active={active === "registrations"} label={t("registrations")} icon="▤" />
          <NavItem href="/admin/badges" active={active === "badges"} label={t("badgePrinting")} icon="▱" />
          <NavItem href="/admin/settings" active={active === "settings"} label={t("settings")} icon="⚙" />
        </nav>
        <div className="admin-sidebar-bottom"><div className="admin-secure"><span />{t("secure")}</div><button className="sidebar-logout" type="button" onClick={async () => { await logout.mutateAsync(); await utils.auth.me.invalidate(); setPath("/admin/login"); }}>{t("signOut")} <span aria-hidden="true">↗</span></button></div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div><div className="admin-breadcrumb">EAD 2026 <span>/</span> {title}</div><h1>{title}</h1></div>
          <div className="admin-top-actions"><LanguageSwitch /><Link href="/" className="desk-return-link">{t("registrationDesk")} <span aria-hidden="true">↗</span></Link></div>
        </header>
        <main className="admin-content">
          {detailMatch ? <RegistrationDetail id={Number(detailMatch[1])} onPrint={startPrint} />
            : active === "dashboard" ? <Dashboard onPrint={startPrint} />
            : active === "registrations" ? <Registrations onPrint={startPrint} />
            : active === "badges" ? <BadgePrinting onPrint={startPrint} />
            : <Settings />}
        </main>
        <nav className="admin-mobile-nav" aria-label={t("eventOperations")}>
          <NavItem href="/admin" active={active === "dashboard"} label={t("dashboard")} icon="⌂" />
          <NavItem href="/admin/registrations" active={active === "registrations"} label={t("registrations")} icon="▤" />
          <NavItem href="/admin/badges" active={active === "badges"} label={t("badgePrinting")} icon="▱" />
          <NavItem href="/admin/settings" active={active === "settings"} label={t("settings")} icon="⚙" />
        </nav>
      </div>
      {printTarget && printPhase === "printing" && <div className="print-root"><BadgePair attendee={printTarget} /></div>}
      {printTarget && (printPhase === "preview" || printPhase === "confirm") && (
        <div className="print-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="staff-print-preview-title">
          <section className="print-preview-card">
            <div className="panel-heading-row"><div><div className="section-overline">{t("badgeReady")}</div><h2 id="staff-print-preview-title">{printPhase === "preview" ? t("printPreviewTitle") : t("printDialogClosed")}</h2></div><button className="modal-close" type="button" onClick={closePrintPreview} aria-label={t("close")}>×</button></div>
            {printPhase === "preview" ? <>
              <div className="staff-print-preview-faces">
                <figure><BadgeTemplate attendee={printTarget} face="front" language={printTarget.language} /><figcaption>{t("front")}</figcaption></figure>
              </div>
              <div className="print-preview-specs"><span>{t("paperSize")}<strong>74 × 105 mm</strong></span><span>{t("printScale")}<strong>{t("printScaleValue")}</strong></span><span>{t("printOneSide")}</span></div>
              <div className="detail-actions"><button className="button button-secondary" type="button" onClick={closePrintPreview}>{t("cancel")}</button><button className="button button-primary" type="button" onClick={openBrowserPrint}>{t("printBadge")}</button></div>
            </> : <>
              <div className="print-confirm-copy"><p>{t("physicalCheck")}</p><strong>{printTarget.name}</strong></div>
              <div className="detail-actions"><button className="button button-secondary" type="button" onClick={closePrintPreview}>{t("cancel")}</button><button className="button button-secondary" type="button" onClick={openBrowserPrint}>{t("printAgain")}</button><button className="button button-primary" type="button" onClick={confirmStaffPrint} disabled={adminPrint.isPending}>{adminPrint.isPending ? t("processing") : t("confirmPrinted")}</button></div>
            </>}
          </section>
        </div>
      )}
      {printSuccess && <div className="print-success-overlay" role="dialog" aria-modal="true" aria-labelledby="print-success-title"><div className="print-success-card"><span className="success-seal">✓</span><div className="section-overline">{t("badgeReady")}</div><h2 id="print-success-title">{t("badgePrinted")}</h2><div className="print-success-preview"><BadgeTemplate attendee={printSuccess.record} face="front" /></div><strong>{printSuccess.record.name}</strong><p>{t("printedAt")}: {new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(printSuccess.time)}</p><div className="detail-actions"><button className="button button-primary" type="button" onClick={() => { setPrintSuccess(null); setPath("/"); }}>{t("registerAnother")}</button><button className="button button-secondary" type="button" onClick={() => setPrintSuccess(null)}>{t("close")}</button></div></div></div>}
    </div>
  );
}

function NavItem({ href, active, label, icon }: { href: string; active: boolean; label: string; icon: string }) {
  return <Link href={href} className={`admin-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>{active && <span className="nav-active-indicator" />}</Link>;
}

function StaffLogin() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
    onError: (error) => {
      setErrorMsg(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    login.mutate({ username, password });
  };

  return (
    <main className="staff-login-page">
      <div className="staff-login-card">
        <EadWordmark compact />
        <div className="section-overline">{t("admin")}</div>
        <h1>{t("staffAccess")}</h1>
        <p>{t("signInHint")}</p>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <label className="staff-field">
            <span>Username</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="staff-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {errorMsg && <p className="form-error-banner" role="alert">{errorMsg}</p>}
          <button className="button button-primary button-large" type="submit" disabled={login.isPending}>
            {login.isPending ? t("processing") : t("signIn")} <span aria-hidden="true">→</span>
          </button>
        </form>
        <Link className="staff-login-back" href="/">← {t("registrationDesk")}</Link>
      </div>
      <div className="staff-login-foot"><LanguageSwitch /><span>{t("eventFooter")}</span></div>
    </main>
  );
}

function AccessDenied({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useLanguage();
  return <main className="staff-login-page"><div className="staff-login-card"><EadWordmark compact /><div className="section-overline">EAD 2026</div><h1>{t("noPermissionTitle")}</h1><p>{t("noPermission")}</p><button className="button button-secondary" type="button" onClick={onSignOut}>{t("signOut")}</button><Link className="staff-login-back" href="/">← {t("registrationDesk")}</Link></div></main>;
}

function Dashboard({ onPrint }: { onPrint: (record: EadRegistration) => void }) {
  const { t, language } = useLanguage();
  const stats = trpc.registration.stats.useQuery();
  const latest = trpc.registration.list.useQuery({ search: "", status: "any", sortBy: "registeredAt", sortDirection: "desc", page: 1, pageSize: 5 });
  const values = stats.data ?? { total: 0, today: 0, printed: 0, pending: 0 };
  const cards = [
    { label: t("totalRegistrations"), value: values.total, accent: "wine", mark: "01" },
    { label: t("todayRegistrations"), value: values.today, accent: "sand", mark: "02" },
    { label: t("badgesPrinted"), value: values.printed, accent: "olive", mark: "03" },
    { label: t("pendingPrints"), value: values.pending, accent: "slate", mark: "04" },
  ];
  return (
    <div className="dashboard-page">
      <div className="admin-page-intro"><div><div className="section-overline">{t("eventDates")}</div><h2>{t("eventName")}</h2><p>{t("registrationDesk")} · {t("secure")}</p></div><Link className="button button-primary" href="/">{t("registrationDesk")} <span>↗</span></Link></div>
      <div className="stat-grid">{cards.map((card) => <article className={`stat-card stat-${card.accent}`} key={card.label}><div className="stat-topline"><span>{card.label}</span><span>{card.mark}</span></div><div className="stat-number">{stats.isLoading ? "—" : new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-GB").format(card.value)}</div><div className="stat-foot"><span className="stat-dot" />{t("eventName")}</div></article>)}</div>
      <section className="admin-panel latest-panel"><div className="panel-heading-row"><div><div className="section-overline">{t("overview")}</div><h3>{t("registrations")}</h3></div><Link className="text-link" href="/admin/registrations">{t("searchResults")} <span>→</span></Link></div><RegistrationTable rows={latest.data?.items ?? []} loading={latest.isLoading} onPrint={onPrint} compact /></section>
    </div>
  );
}

function Registrations({ onPrint }: { onPrint: (record: EadRegistration) => void }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("search") ?? "");
  const [status, setStatus] = useState<"any" | "printed" | "pending">("any");
  const [sortBy, setSortBy] = useState<"registeredAt" | "name" | "company" | "email" | "badgePrinted">("registeredAt");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const list = trpc.registration.list.useQuery({ search: deferredSearch, status, sortBy, sortDirection: sortBy === "registeredAt" ? "desc" : "asc", page, pageSize: 20 }, { placeholderData: (previous) => previous });
  useEffect(() => setPage(1), [deferredSearch, status, sortBy]);
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 20));
  return (
    <div className="admin-panel registrations-panel">
      <div className="registrations-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} aria-label={t("search")} /><kbd>⌘ K</kbd></label><select aria-label={t("badgeStatus")} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="any">{t("allStatuses")}</option><option value="pending">{t("pending")}</option><option value="printed">{t("printed")}</option></select><select aria-label={t("sorting")} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="registeredAt">{t("registrationTime")}</option><option value="name">{t("name")}</option><option value="company">{t("company")}</option><option value="email">{t("email")}</option></select></div>
      <RegistrationTable rows={list.data?.items ?? []} loading={list.isLoading} onPrint={onPrint} />
      {list.data && <div className="pagination-row"><span>{new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-GB").format(list.data.total)} · {t("registrations")}</span><div><button className="pagination-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t("previous")}</button><span>{t("page")} {page} {t("of")} {totalPages}</span><button className="pagination-button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t("next")}</button></div></div>}
    </div>
  );
}

function RegistrationTable({ rows, loading, onPrint, compact = false }: { rows: EadRegistration[]; loading: boolean; onPrint: (record: EadRegistration) => void; compact?: boolean }) {
  const { t, language } = useLanguage();
  if (loading) return <div className="table-loading"><span className="spinner" />{t("loading")}</div>;
  if (!rows.length) return <div className="empty-state"><span className="empty-symbol">E</span><h3>{t("noResults")}</h3><p>{t("noResultsHint")}</p></div>;
  const dateFormat = new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: compact ? undefined : "numeric", hour: compact ? undefined : "2-digit", minute: compact ? undefined : "2-digit" });
  return (
    <div className="table-scroll"><table className="registration-table"><thead><tr><th>{t("name")}</th><th>{t("company")}</th>{!compact && <th>{t("title")}</th>}<th>{t("email")}</th><th>{t("registrationTime")}</th><th>{t("badgeStatus")}</th><th>{t("actions")}</th></tr></thead>
      <tbody>{rows.map((record) => <tr key={record.id}><td><Link className="attendee-name-cell" href={`/admin/registrations/${record.id}`}>{record.name}<small>{record.registrationId}</small></Link></td><td>{record.company}</td>{!compact && <td>{record.title}</td>}<td className="email-cell">{record.email}</td><td className="time-cell">{dateFormat.format(new Date(record.registeredAt))}</td><td><span className={`status-pill ${record.badgePrinted ? "is-printed" : "is-pending"}`}><i />{record.badgePrinted ? t("printed") : t("pending")}</span></td><td><div className="table-actions"><Link href={`/admin/registrations/${record.id}`} aria-label={`${t("view")} ${record.name}`} title={t("view")}>{t("view")}</Link><Link href={`/admin/registrations/${record.id}?edit=1`} aria-label={`${t("edit")} ${record.name}`} title={t("edit")}>{t("edit")}</Link><button type="button" onClick={() => onPrint(record)} aria-label={`${record.badgePrinted ? t("reprint") : t("print")} ${record.name}`} title={record.badgePrinted ? t("reprint") : t("print")}><span aria-hidden="true">▱</span><span>{record.badgePrinted ? t("reprint") : t("print")}</span></button></div></td></tr>)}</tbody></table></div>
  );
}

function RegistrationDetail({ id, onPrint }: { id: number; onPrint: (record: EadRegistration) => void }) {
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();
  const query = trpc.registration.byId.useQuery({ id });
  const [editing, setEditing] = useState(() => new URLSearchParams(window.location.search).get("edit") === "1");
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState<RegistrationForm | null>(null);

  const update = trpc.registration.update.useMutation({
    onSuccess: async () => { await Promise.all([utils.registration.byId.invalidate({ id }), utils.registration.list.invalidate(), utils.registration.stats.invalidate()]); toast.success(t("saved")); setEditing(false); setOverrideDuplicate(false); },
    onError: (error) => setSaveError(error.data?.code === "CONFLICT" ? t("duplicateMessage") : t("saveError")),
  });
  useEffect(() => { if (query.data) setForm(initialRegistrationForm(query.data)); }, [query.data]);
  if (query.isLoading) return <div className="table-loading"><span className="spinner" />{t("loading")}</div>;
  if (!query.data || !form) return <div className="empty-state"><h3>{t("noResults")}</h3><Link className="button button-secondary" href="/admin/registrations">{t("registrations")}</Link></div>;
  const record = query.data;
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaveError(""); update.mutate({ ...form, id, overrideDuplicate }); };
  const date = new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="registration-detail-layout">
      <section className="admin-panel detail-panel">
        <div className="panel-heading-row"><div><div className="section-overline">{record.registrationId}</div><h2>{record.name}</h2></div><span className={`status-pill ${record.badgePrinted ? "is-printed" : "is-pending"}`}><i />{record.badgePrinted ? t("printed") : t("pending")}</span></div>
        {editing ? <form className="edit-registration-form" onSubmit={submit}>
          <StaffField label={t("name")} value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <StaffField label={t("company")} value={form.company} onChange={(company) => setForm({ ...form, company })} />
          <StaffField label={t("title")} value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <StaffField label={t("email")} value={form.email} type="email" onChange={(email) => setForm({ ...form, email })} />
          <label className="staff-field"><span>{t("registrationLanguage")}</span><select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value as EadLanguage })}><option value="en">English</option><option value="ar">العربية</option></select></label>
          <label className="override-check"><input type="checkbox" checked={overrideDuplicate} onChange={(event) => setOverrideDuplicate(event.target.checked)} /><span><strong>{t("emailOverride")}</strong><small>{t("emailOverrideHint")}</small></span></label>
          {saveError && <p className="form-error-banner" role="alert">{saveError}</p>}
          <div className="detail-actions"><button className="button button-primary" type="submit" disabled={update.isPending}>{update.isPending ? t("processing") : t("saveChanges")}</button><button className="button button-secondary" type="button" onClick={() => { setEditing(false); setForm(initialRegistrationForm(record)); setOverrideDuplicate(false); }}>{t("cancel")}</button></div>
        </form> : <>
          <dl className="detail-list"><div><dt>{t("name")}</dt><dd>{record.name}</dd></div><div><dt>{t("company")}</dt><dd>{record.company}</dd></div><div><dt>{t("title")}</dt><dd>{record.title}</dd></div><div><dt>{t("email")}</dt><dd>{record.email}</dd></div><div><dt>{t("registrationLanguage")}</dt><dd>{record.language === "ar" ? "العربية" : "English"}</dd></div><div><dt>{t("registered")}</dt><dd>{date.format(new Date(record.registeredAt))}</dd></div><div><dt>{t("lastUpdated")}</dt><dd>{date.format(new Date(record.updatedAt))}</dd></div>{record.badgePrintedAt && <div><dt>{t("printedAt")}</dt><dd>{date.format(new Date(record.badgePrintedAt))}</dd></div>}</dl>
          <div className="detail-actions"><button className="button button-secondary" type="button" onClick={() => { setSaveError(""); setOverrideDuplicate(false); setEditing(true); }}>{t("editInformation")}</button><button className="button button-primary" type="button" onClick={() => onPrint(record)}>{record.badgePrinted ? t("reprint") : t("printBadge")}</button></div>
        </>}
      </section>
      <section className="admin-panel detail-badge-panel"><div className="panel-heading-row"><div><div className="section-overline">{t("badgeReady")}</div><h3>{record.registrationId}</h3></div><span className="badge-size-label">74 × 105 mm</span></div><div className="detail-badge-preview"><BadgeTemplate attendee={record} face="front" language={record.language} /></div></section>
    </div>
  );
}

function StaffField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="staff-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></label>;
}

function BadgePrinting({ onPrint }: { onPrint: (record: EadRegistration) => void }) {
  const { t } = useLanguage();
  const pending = trpc.registration.pending.useQuery({ limit: 100 });
  return <section className="admin-panel badge-printing-panel"><div className="panel-heading-row"><div><div className="section-overline">{t("pendingPrints")}</div><h2>{t("badgePrinting")}</h2></div><span className="pending-count">{pending.data?.length ?? 0}</span></div><p className="panel-description">{t("physicalCheck")}</p><RegistrationTable rows={pending.data ?? []} loading={pending.isLoading} onPrint={onPrint} /></section>;
}

function Settings() {
  const { t, language, setLanguage } = useLanguage();
  return (
    <div className="settings-grid">
      <section className="admin-panel settings-card"><div className="section-overline">{t("eventInformation")}</div><h2>{t("eventName")}</h2><div className="settings-fact"><span>{t("eventDates")}</span><strong>{t("eventDate")} · {t("cityLine")}</strong></div><div className="settings-fact"><span>{t("secure")}</span><strong>{t("signInHint")}</strong></div></section>
      <section className="admin-panel settings-card"><div className="section-overline">{t("languageSettings")}</div><h2>{t("switchLanguage")}</h2><div className="language-preference"><button className={language === "en" ? "selected" : ""} type="button" onClick={() => setLanguage("en")}>English</button><button className={language === "ar" ? "selected" : ""} type="button" onClick={() => setLanguage("ar")}>العربية</button></div></section>
      <section className="admin-panel settings-card"><div className="section-overline">{t("badgeTemplate")}</div><h2>{t("templateReference")}</h2><img className="reference-art-image" src={REFERENCE_ART} alt={t("templateReference")} /><div className="print-setting-rows"><div><span>{t("paperSize")}</span><strong>7.4 × 10.5 cm · 74 × 105 mm</strong></div><div><span>{t("printScale")}</span><strong>{t("printScaleValue")}</strong></div><div><span>{t("onePage")}</span><strong>{t("printOneSide")}</strong></div></div></section>
      <section className="admin-panel settings-card"><div className="section-overline">{t("printingSettings")}</div><h2>{t("printingSettings")}</h2><div className="print-setting-rows"><div><span>{t("paperSize")}</span><strong>74 × 105 mm</strong></div><div><span>{t("printScale")}</span><strong>{t("printScaleValue")}</strong></div><div><span>{t("onePage")}</span><strong>{t("printOneSide")}</strong></div></div></section>
      <section className="admin-panel settings-card lanyard-settings"><div className="lanyard-setting-header"><div><div className="section-overline">{t("lanyardPreview")}</div><h2>{t("lanyardPreview")}</h2></div><span>{t("lanyardSize")}</span></div><div className="lanyard-visual" style={{ backgroundImage: `url("${LANYARD_ART}")` }} role="img" aria-label={t("lanyardPattern")} /><p>{t("lanyardPattern")}</p></section>
    </div>
  );
}
