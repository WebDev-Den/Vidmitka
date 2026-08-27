"use client";

import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  GraduationCap,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  QrCode,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";

type Status = "present" | "absent" | "excused";
type View = "journal" | "rollcall" | "courses" | "reports" | "student" | "auth";
type Student = {
  id: number;
  name: string;
  initials: string;
  group: string;
  subgroup: 1 | 2;
  card: string;
  status: Status;
};
type Lesson = {
  id: number;
  title: string;
  format: string;
  pair: string;
  startsAt: string;
  endsAt: string;
  date: string;
  group: string;
};

const seedStudentRows: [string, string, string, 1 | 2, string][] = [
  ["Анна Ковальчук", "АК", "КН-21", 1, "КН2101"],
  ["Богдан Мельник", "БМ", "КН-21", 1, "КН2102"],
  ["Вікторія Шевченко", "ВШ", "КН-21", 2, "КН2103"],
  ["Гліб Ткаченко", "ГТ", "КН-21", 2, "КН2104"],
  ["Дарина Бондар", "ДБ", "КН-21", 1, "КН2105"],
  ["Єгор Лисенко", "ЄЛ", "КН-21", 2, "КН2106"],
  ["Жанна Романюк", "ЖР", "ПІ-22", 1, "ПІ2201"],
  ["Ілля Кравець", "ІК", "ПІ-22", 1, "ПІ2202"],
  ["Катерина Поліщук", "КП", "ПІ-22", 2, "ПІ2203"],
  ["Максим Савчук", "МС", "ПІ-22", 2, "ПІ2204"],
  ["Назар Олійник", "НО", "ПІ-22", 1, "ПІ2205"],
  ["Олена Мороз", "ОМ", "ПІ-22", 2, "ПІ2206"],
];

const seedStudents: Student[] = seedStudentRows.map((s, i) => ({
  id: i + 1,
  name: s[0],
  initials: s[1],
  group: s[2],
  subgroup: s[3] as 1 | 2,
  card: s[4],
  status: i === 3 || i === 9 ? "absent" : i === 5 ? "excused" : "present",
}));

const seedLessons: Lesson[] = [
  {
    id: 1,
    title: "Основи програмування",
    format: "Лекція",
    pair: "1 пара",
    startsAt: "09:00",
    endsAt: "10:20",
    date: "2024-03-12",
    group: "КН-21",
  },
];

const nav = [
  { id: "journal" as View, label: "Журнал занять", icon: ClipboardCheck },
  { id: "rollcall" as View, label: "Швидка перекличка", icon: Zap },
  { id: "courses" as View, label: "Курси та групи", icon: BookOpen },
  { id: "reports" as View, label: "Звіти та матриця", icon: BarChart3 },
  { id: "student" as View, label: "Кабінет студента", icon: GraduationCap },
  { id: "auth" as View, label: "Вхід / реєстрація", icon: ShieldCheck },
];
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const formatLessonDate = (date: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(`${date}T12:00:00+03:00`));
function AnimatedLogo({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="animated-logo"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-label="Логотип Відмітка"
      role="img"
    >
      <rect className="logo-paper" x="5" y="4" width="30" height="32" rx="8" />
      <path className="logo-check" d="M12 20.5l5.2 5.2L28.5 14" />
      <path className="logo-fold" d="M25 4v8h10" />
      <circle className="logo-dot" cx="9" cy="9" r="2" />
    </svg>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"pill pill-" + tone}>{children}</span>;
}
function Avatar({
  initials,
  size = "md",
}: {
  initials: string;
  size?: string;
}) {
  return <span className={"avatar avatar-" + size}>{initials}</span>;
}
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={"surface " + className}>{children}</section>;
}
function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState<View>("journal"),
    [students, setStudents] = useState(seedStudents),
    [lessons, setLessons] = useState(seedLessons),
    [activeLessonId, setActiveLessonId] = useState(seedLessons[0].id),
    [query, setQuery] = useState(""),
    [subgroup, setSubgroup] = useState("all"),
    [mobileNav, setMobileNav] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [modal, setModal] = useState<
      "rollcall" | "course" | "lesson" | "qr" | "profile" | null
    >(null),
    [toast, setToast] = useState("");
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const update = async (id: number, status: Status) => {
    setStudents((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
    await wait(120);
  };
  const createLesson = (lesson: Lesson) => {
    setLessons((current) => [...current, lesson]);
    setActiveLessonId(lesson.id);
    setModal(null);
    setView("journal");
    notify("Заняття створено та відкрито в журналі");
  };
  const present = students.filter((s) => s.status === "present").length;
  const activeLesson =
    lessons.find((lesson) => lesson.id === activeLessonId) ?? lessons[0];
  return (
    <div className="app theme-paper">
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <header className="topbar">
        <button
          className="mobile-menu"
          onClick={() => setMobileNav(!mobileNav)}
          aria-label={mobileNav ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={mobileNav}
        >
          <Menu size={20} />
        </button>
        <div className="brand">
          <AnimatedLogo size={32} />
          Відмітка
        </div>
        <div className="crumb">
          <span>Викладач</span>
          <span className="slash">/</span>
          <strong>{nav.find((n) => n.id === view)?.label}</strong>
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Налаштування"
            onClick={() => setModal("profile")}
          >
            <Settings2 size={18} />
          </button>
          <div className="profile">
            <Avatar initials="ОП" size="sm" />
            <span>
              <b>Олексій Петренко</b>
              <small>Кафедра комп’ютерних наук</small>
            </span>
          </div>
        </div>
      </header>
      <button
        className={mobileNav ? "nav-backdrop show" : "nav-backdrop"}
        onClick={() => setMobileNav(false)}
        aria-label="Закрити навігаційне меню"
        tabIndex={mobileNav ? 0 : -1}
      />
      <div className={sidebarCollapsed ? "layout sidebar-collapsed" : "layout"}>
        <aside
          className={`sidebar${mobileNav ? " open" : ""}${
            sidebarCollapsed ? " collapsed" : ""
          }`}
        >
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={
              sidebarCollapsed
                ? "Розгорнути бічну панель"
                : "Згорнути бічну панель ліворуч"
            }
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Розгорнути панель" : "Згорнути панель"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span>{sidebarCollapsed ? "Розгорнути" : "Згорнути панель"}</span>
          </button>
          <div className="side-title">РОБОЧИЙ ПРОСТІР</div>
          {nav.slice(0, 4).map((n) => {
            const I = n.icon;
            return (
              <button
                key={n.id}
                className={view === n.id ? "side-link active" : "side-link"}
                onClick={() => {
                  setView(n.id);
                  setMobileNav(false);
                }}
                title={sidebarCollapsed ? n.label : undefined}
              >
                <I size={18} />
                <span>{n.label}</span>
                {n.id === "journal" && (
                  <span className="side-count">{lessons.length}</span>
                )}
              </button>
            );
          })}
          <div className="side-title second">ПЕРЕГЛЯД</div>
          {nav.slice(4).map((n) => {
            const I = n.icon;
            return (
              <button
                key={n.id}
                className={view === n.id ? "side-link active" : "side-link"}
                onClick={() => {
                  setView(n.id);
                  setMobileNav(false);
                }}
                title={sidebarCollapsed ? n.label : undefined}
              >
                <I size={18} />
                <span>{n.label}</span>
              </button>
            );
          })}
          <div className="side-footer">
            <div className="sync">
              <span className="dot" />
              Синхронізовано
            </div>
            <small>
              Останнє оновлення
              <br />
              сьогодні о 09:42
            </small>
          </div>
        </aside>
        <main className="content">
          {view === "journal" && (
            <Journal
              students={students}
              present={present}
              query={query}
              setQuery={setQuery}
              subgroup={subgroup}
              setSubgroup={setSubgroup}
              lesson={activeLesson}
              lessons={lessons}
              onSelectLesson={setActiveLessonId}
              onCreateLesson={() => setModal("lesson")}
              update={update}
              onRollCall={() => setModal("rollcall")}
              notify={notify}
            />
          )}{" "}
          {view === "rollcall" && (
            <RollCall
              students={students}
              update={update}
              onDone={() => setView("journal")}
            />
          )}{" "}
          {view === "courses" && (
            <Courses setModal={setModal} notify={notify} />
          )}{" "}
          {view === "reports" && <Reports notify={notify} />}{" "}
          {view === "student" && <StudentDashboard setModal={setModal} />}{" "}
          {view === "auth" && <Auth notify={notify} />}
        </main>
      </div>
      {modal === "rollcall" && (
        <div className="overlay">
          <button
            className="close-overlay"
            onClick={() => setModal(null)}
            aria-label="Закрити"
          >
            <X />
          </button>
          <RollCall
            students={students}
            update={update}
            onDone={() => {
              setModal(null);
              setView("journal");
            }}
          />
        </div>
      )}
      {modal === "course" && (
        <Modal title="Новий курс" close={() => setModal(null)}>
          <label>
            Назва курсу
            <input autoFocus placeholder="Наприклад, Основи програмування" />
          </label>
          <label>
            Група
            <select>
              <option>КН-21</option>
              <option>ПІ-22</option>
            </select>
          </label>
          <button
            className="button button-primary full"
            onClick={() => {
              setModal(null);
              notify("Курс створено");
            }}
          >
            Створити курс
          </button>
        </Modal>
      )}
      {modal === "lesson" && (
        <Modal title="Нове заняття" close={() => setModal(null)}>
          <CreateLessonForm onCreate={createLesson} />
        </Modal>
      )}
      {modal === "profile" && (
        <ProfileSettings close={() => setModal(null)} notify={notify} />
      )}{" "}
      {modal === "qr" && (
        <Modal title="Запрошення до курсу" close={() => setModal(null)}>
          <div className="qr-box">
            <QrCode size={120} />
            <b>Код курсу: KN21-24</b>
            <small>Покажіть цей код студентам або скопіюйте посилання.</small>
          </div>
          <button
            className="button button-primary full"
            onClick={() => {
              navigator.clipboard?.writeText("KN21-24");
              notify("Код скопійовано");
              setModal(null);
            }}
          >
            Скопіювати код
          </button>
        </Modal>
      )}
    </div>
  );
}
function Journal({
  students,
  present,
  query,
  setQuery,
  subgroup,
  setSubgroup,
  lesson,
  lessons,
  onSelectLesson,
  onCreateLesson,
  update,
  onRollCall,
  notify,
}: {
  students: Student[];
  present: number;
  query: string;
  setQuery: (v: string) => void;
  subgroup: string;
  setSubgroup: (v: string) => void;
  lesson: Lesson;
  lessons: Lesson[];
  onSelectLesson: (id: number) => void;
  onCreateLesson: () => void;
  update: (id: number, s: Status) => Promise<void>;
  onRollCall: () => void;
  notify: (v: string) => void;
}) {
  const filtered = students.filter(
    (s) =>
      (!query ||
        `${s.name} ${s.card}`.toLowerCase().includes(query.toLowerCase())) &&
      (subgroup === "all" || String(s.subgroup) === subgroup),
  );
  return (
    <>
      <PageHeader
        eyebrow={formatLessonDate(lesson.date).toLocaleUpperCase("uk-UA")}
        title="Журнал занять"
      >
        <button className="button button-secondary" onClick={onCreateLesson}>
          <Plus size={17} />
          Створити заняття
        </button>
        <button className="button button-primary" onClick={onRollCall}>
          <Zap size={17} />
          Почати швидку перекличку
        </button>
      </PageHeader>
      <div className="lesson-strip">
        <div className="lesson-main">
          <span className="lesson-icon">
            <BookOpen size={18} />
          </span>
          <div>
            <b>{lesson.title}</b>
            <span>
              {lesson.format} · {lesson.pair} · {lesson.startsAt}–
              {lesson.endsAt} · {lesson.group}
            </span>
          </div>
        </div>
        <div className="lesson-meta">
          <label>
            Заняття
            <select
              value={lesson.id}
              onChange={(event) => onSelectLesson(Number(event.target.value))}
            >
              {lessons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.date} · {item.startsAt}
                </option>
              ))}
            </select>
          </label>
          <label>
            Підгрупа
            <select
              value={subgroup}
              onChange={(e) => setSubgroup(e.target.value)}
            >
              <option value="all">Всі студенти</option>
              <option value="1">Підгрупа 1</option>
              <option value="2">Підгрупа 2</option>
            </select>
          </label>
          <div className="attendance-stat">
            <strong>
              {present}/{students.length}
            </strong>
            <span>
              присутні · {Math.round((present / students.length) * 100)}%
            </span>
          </div>
        </div>
      </div>
      <Card className="journal-card">
        <div className="card-toolbar">
          <div>
            <h2>Студенти курсу</h2>
            <p>{filtered.length} записів · зміни зберігаються автоматично</p>
          </div>
          <div className="toolbar-actions">
            <div className="search">
              <Search size={17} />
              <input
                aria-label="Пошук студента за іменем або ID"
                placeholder="Пошук за іменем або ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="button button-secondary"
              onClick={async () => {
                await Promise.all(students.map((s) => update(s.id, "present")));
                notify("Усі студенти позначені присутніми");
              }}
            >
              <Check size={16} />
              Всі присутні
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>СТУДЕНТ</th>
                <th>ГРУПА</th>
                <th>СТАТУС</th>
                <th className="align-right">ID КАРТКИ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="student-cell">
                      <Avatar initials={s.initials} />
                      <div>
                        <b>{s.name}</b>
                        <small>Студент університету</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Pill tone="blue">
                      {s.group} · {s.subgroup}
                    </Pill>
                  </td>
                  <td>
                    <select
                      aria-label={`Статус відвідування: ${s.name}`}
                      className={"status-select " + s.status}
                      value={s.status}
                      onChange={(e) => update(s.id, e.target.value as Status)}
                    >
                      <option value="present">Присутній</option>
                      <option value="absent">Відсутній</option>
                      <option value="excused">Поважна причина</option>
                    </select>
                  </td>
                  <td className="align-right mono">{s.card}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">Студентів за цим запитом не знайдено.</div>
          )}
        </div>
      </Card>
    </>
  );
}
function RollCall({
  students,
  update,
  onDone,
}: {
  students: Student[];
  update: (id: number, s: Status) => Promise<void>;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <Card className="finish-card">
        <span className="finish-icon">
          <Check size={30} />
        </span>
        <div className="eyebrow">ПЕРЕКЛИЧКА ЗАВЕРШЕНА</div>
        <h2>Усі студенти опрацьовані</h2>
        <p>Дані готові до збереження в журналі занять.</p>
        <button className="button button-primary" onClick={onDone}>
          Зберегти та перейти до журналу
          <ChevronRight size={17} />
        </button>
      </Card>
    );
  const s = students[i];
  const mark = async (status: Status) => {
    await update(s.id, status);
    if (i === students.length - 1) setDone(true);
    else setI(i + 1);
  };
  return (
    <div className="roll-page">
      <PageHeader
        eyebrow="ФОКУС-РЕЖИМ · ОСНОВИ ПРОГРАМУВАННЯ"
        title="Швидка перекличка"
      >
        <button className="button button-secondary" onClick={onDone}>
          <ChevronLeft size={17} />
          До журналу
        </button>
      </PageHeader>
      <Card className="roll-card">
        <div className="progress-row">
          <span>
            Студент <b>{i + 1}</b> з {students.length}
          </span>
          <span>{Math.round(((i + 1) / students.length) * 100)}%</span>
        </div>
        <div className="progress">
          <span style={{ width: `${((i + 1) / students.length) * 100}%` }} />
        </div>
        <div className="roll-person">
          <Avatar initials={s.initials} size="lg" />
          <h2>{s.name}</h2>
          <div className="person-tags">
            <Pill tone="blue">{s.group}</Pill>
            <Pill>Підгрупа {s.subgroup}</Pill>
          </div>
          <span className="card-id">ID картки · {s.card}</span>
        </div>
        <div className="big-actions">
          <button className="big-action absent" onClick={() => mark("absent")}>
            <X size={24} />
            <span>Відсутній</span>
            <small>Натисніть N</small>
          </button>
          <button
            className="big-action present"
            onClick={() => mark("present")}
          >
            <Check size={24} />
            <span>Присутній</span>
            <small>Натисніть P</small>
          </button>
        </div>
        <div className="roll-secondary">
          <button disabled={i === 0} onClick={() => setI(Math.max(0, i - 1))}>
            ← Назад
          </button>
          <button onClick={() => mark("excused")}>Поважна причина</button>
        </div>
      </Card>
    </div>
  );
}
function Courses({
  setModal,
  notify,
}: {
  setModal: (m: "course" | "qr" | null) => void;
  notify: (v: string) => void;
}) {
  const [requests, setRequests] = useState([
    "Софія Данилюк · КН-21",
    "Роман Гнатюк · ПІ-22",
    "Марія Климчук · КН-21",
  ]);
  return (
    <>
      <PageHeader eyebrow="КЕРУВАННЯ НАВЧАННЯМ" title="Курси та групи">
        <button
          className="button button-primary"
          onClick={() => setModal("course")}
        >
          + Створити курс
        </button>
      </PageHeader>
      <div className="course-grid">
        <Card className="course-hero">
          <div className="course-top">
            <span className="course-color">
              <BookOpen size={20} />
            </span>
            <Pill tone="green">Активний курс</Pill>
          </div>
          <h2>Основи програмування</h2>
          <p>Обов’язкова дисципліна · Весняний семестр 2024</p>
          <div className="course-stats">
            <div>
              <strong>28</strong>
              <span>студентів</span>
            </div>
            <div>
              <strong>2</strong>
              <span>групи</span>
            </div>
            <div>
              <strong>86%</strong>
              <span>відвідуваність</span>
            </div>
          </div>
          <button
            className="button button-secondary"
            onClick={() => setModal("qr")}
          >
            <QrCode size={16} />
            QR-код курсу
          </button>
        </Card>
        <Card>
          <div className="card-toolbar compact">
            <div>
              <h2>Запити на приєднання</h2>
              <p>Потрібна ваша перевірка</p>
            </div>
            <Pill tone="amber">{requests.length} нові</Pill>
          </div>
          {requests.map((x) => (
            <div className="request" key={x}>
              <Avatar
                initials={x
                  .split(" ")
                  .map((a) => a[0])
                  .join("")
                  .slice(0, 2)}
              />
              <div>
                <b>{x.split(" · ")[0]}</b>
                <small>{x.split(" · ")[1]} · щойно</small>
              </div>
              <button
                className="request-check"
                aria-label="Прийняти"
                onClick={() => {
                  setRequests((r) => r.filter((v) => v !== x));
                  notify("Студента прийнято до курсу");
                }}
              >
                <Check size={16} />
              </button>
              <button
                className="request-x"
                aria-label="Відхилити"
                onClick={() => setRequests((r) => r.filter((v) => v !== x))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {!requests.length && (
            <div className="empty">Нових запитів немає.</div>
          )}
        </Card>
      </div>
    </>
  );
}
function Reports({ notify }: { notify: (v: string) => void }) {
  const [period, setPeriod] = useState("Сьогодні"),
    [course, setCourse] = useState("Основи програмування"),
    [q, setQ] = useState("");
  const rows = seedStudents.filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );
  const exportFile = async () => {
    await wait(500);
    notify("CSV-звіт підготовлено до завантаження");
  };
  return (
    <>
      <PageHeader eyebrow="АНАЛІТИКА ВІДВІДУВАНОСТІ" title="Звіти та матриця">
        <button className="button button-primary" onClick={exportFile}>
          <Download size={17} />
          Експорт CSV
        </button>
      </PageHeader>
      <div className="report-controls">
        <div className="filter-tabs">
          {["Сьогодні", "Цей тиждень", "Цей місяць", "Семестр"].map((x) => (
            <button
              key={x}
              className={period === x ? "active" : ""}
              onClick={() => setPeriod(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <select value={course} onChange={(e) => setCourse(e.target.value)}>
          <option>Основи програмування</option>
          <option>Дискретна математика</option>
        </select>
      </div>
      <div className="report-stats">
        <Card>
          <span className="stat-label">СЕРЕДНЯ ПРИСУТНІСТЬ</span>
          <strong>86.4%</strong>
          <Pill tone="green">+4.2% цього м��сяця</Pill>
        </Card>
        <Card>
          <span className="stat-label">ПРОВЕДЕНО ЗАН��ТЬ</span>
          <strong>24</strong>
          <span className="muted">з 32 запланованих</span>
        </Card>
        <Card>
          <span className="stat-label">ПОТРЕБУЮТЬ УВАГИ</span>
          <strong className="danger-text">5</strong>
          <span className="muted">студентів нижче 70%</span>
        </Card>
      </div>
      <Card className="matrix-card">
        <div className="card-toolbar compact">
          <div>
            <h2>Матриця відвідування</h2>
            <p>
              {course} · період: {period.toLowerCase()}
            </p>
          </div>
          <div className="search">
            <Search size={17} />
            <input
              placeholder="Знайти студента"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>СТУДЕНТ</th>
                {["05.03", "07.03", "12.03", "14.03", "19.03"].map((x) => (
                  <th key={x}>{x}</th>
                ))}
                <th>ВІДСУТНІ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="student-cell">
                      <Avatar initials={s.initials} size="sm" />
                      <div>
                        <b>{s.name}</b>
                        <small>
                          {s.group} · {s.card}
                        </small>
                      </div>
                    </div>
                  </td>
                  {["П", "П", "Н", "ПП", "П"].map((m, j) => (
                    <td key={j}>
                      <span
                        className={
                          "matrix-mark " +
                          (m === "П"
                            ? "is-present"
                            : m === "Н"
                              ? "is-absent"
                              : "is-excused")
                        }
                      >
                        {m}
                      </span>
                    </td>
                  ))}
                  <td className="abs-count">{i % 3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function StudentDashboard({
  setModal,
}: {
  setModal: (m: "qr" | null) => void;
}) {
  return (
    <>
      <PageHeader eyebrow="ОСОБИСТИЙ КАБІНЕТ" title="Привіт, Анно">
        <button
          className="button button-primary"
          onClick={() => setModal("qr")}
        >
          <QrCode size={17} />
          Приєднатися до курсу
        </button>
      </PageHeader>
      <Card className="student-profile">
        <Avatar initials="АК" size="lg" />
        <div>
          <h2>Анна Ковальчук</h2>
          <p>Студентка · КН-21 · Підгрупа 1</p>
          <span className="mono">ID КН2101 · anna.kovalchuk@univ.edu</span>
        </div>
        <div className="profile-att">
          <strong>92%</strong>
          <span>середня присутність</span>
        </div>
      </Card>
      <div className="dashboard-grid">
        <Card>
          <div className="card-toolbar compact">
            <div>
              <h2>Мої курси</h2>
              <p>Поточний семестр</p>
            </div>
            <CalendarDays size={19} />
          </div>
          {[
            ["Основи програмування", "Олексій Петренко", "92%"],
            ["Дискретна математика", "Ірина Коваль", "88%"],
            ["Проєктний практикум", "Микола Бойко", "96%"],
          ].map((c) => (
            <div className="course-progress" key={c[0]}>
              <span className="mini-course blue">
                <BookOpen size={16} />
              </span>
              <div>
                <b>{c[0]}</b>
                <small>{c[1]}</small>
                <div className="line">
                  <span style={{ width: c[2] }} />
                </div>
              </div>
              <strong>{c[2]}</strong>
            </div>
          ))}
        </Card>
        <Card>
          <div className="card-toolbar compact">
            <div>
              <h2>Останні відмітки</h2>
              <p>Історія відвідування</p>
            </div>
          </div>
          {[
            "Основи програмування",
            "Дискретна математика",
            "Проєктний практикум",
            "Основи програмування",
          ].map((x, i) => (
            <div className="history" key={x + i}>
              <span
                className={"history-dot " + (i === 2 ? "excused" : "present")}
              />
              <div>
                <b>{x}</b>
                <small>
                  {12 - i} березня · {i + 1} пара
                </small>
              </div>
              <Pill tone={i === 2 ? "amber" : "green"}>
                {i === 2 ? "Поважна" : "Присутня"}
              </Pill>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
function Auth({ notify }: { notify: (v: string) => void }) {
  const [role, setRole] = useState("student"),
    [mode, setMode] = useState<"login" | "register">("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const submit = () => {
    if (mode === "register") {
      if (
        !name.trim() ||
        !email.trim() ||
        password.length < 8 ||
        password !== confirm
      ) {
        notify("Перевірте ім’я, email і пароль від 8 символів");
        return;
      }
      notify(
        `Акаунт створено для ролі «${role === "student" ? "студент" : "викладач"}»`,
      );
      setMode("login");
      setName("");
      setPassword("");
      setConfirm("");
    } else {
      if (!email.trim() || !password) {
        notify("Введіть email і пароль");
        return;
      }
      notify(
        `Демо-вхід для ролі «${role === "student" ? "студент" : "викладач"}» виконано`,
      );
    }
  };
  return (
    <div className="auth-wrap">
      <div className="auth-copy">
        <span className="brand-mark">
          <Check size={20} />
        </span>
        <div className="eyebrow">ЄДИНИЙ ПРОСТІР ВІДВІДУВАНОСТІ</div>
        <h1>
          Менше паперу.
          <br />
          <em>Більше присутності.</em>
        </h1>
        <p>Простий інструмент для викладачів і студентів.</p>
      </div>
      <Card className="auth-card">
        <div className="role-toggle">
          <button
            className={role === "student" ? "active" : ""}
            onClick={() => setRole("student")}
          >
            Я студент
          </button>
          <button
            className={role === "teacher" ? "active" : ""}
            onClick={() => setRole("teacher")}
          >
            Я викладач
          </button>
        </div>
        <div className="auth-mode">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Вхід
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Реєстрація
          </button>
        </div>
        <h2>{mode === "login" ? "Вітаємо у Відмітці" : "Створіть акаунт"}</h2>
        <p>
          {mode === "login"
            ? "Увійдіть, щоб продовжити робот��"
            : "Заповніть дані для нового профілю"}
        </p>
        {mode === "register" && (
          <label>
            Ім’я та прізвище
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Анна Ковальчук"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@univ.edu"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Мінімум 8 символів"
          />
        </label>
        {mode === "register" && (
          <label>
            Повторіть пароль
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Введіть пароль ще раз"
            />
          </label>
        )}
        <button className="button button-primary full" onClick={submit}>
          {mode === "login" ? "Увійти" : "Зареєструватися"}{" "}
          <ChevronRight size={17} />
        </button>
        {mode === "login" && (
          <>
            <div className="auth-divider">
              <span>або</span>
            </div>
            <button
              className="button button-secondary full"
              onClick={() => setMode("register")}
            >
              Створити акаунт
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
function ProfileSettings({
  close,
  notify,
}: {
  close: () => void;
  notify: (v: string) => void;
}) {
  const [tab, setTab] = useState<"profile" | "notifications" | "security">(
      "profile",
    ),
    [name, setName] = useState("Олексій Петренко"),
    [email, setEmail] = useState("oleksii.petrenko@univ.edu"),
    [dept, setDept] = useState("Кафедра комп’ютерних наук"),
    [saved, setSaved] = useState(false);
  const save = () => {
    if (!name.trim() || !email.includes("@")) {
      notify("Перевірте ім’я та email");
      return;
    }
    setSaved(true);
    notify("Налаштування профілю збережено");
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="modal-backdrop">
      <div
        className="modal profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <button className="modal-close" onClick={close} aria-label="Закрити">
          <X size={18} />
        </button>
        <div className="eyebrow">НАЛАШТУВАННЯ</div>
        <h2 id="profile-title">Профіль та налаштування</h2>
        <div className="profile-tabs">
          {[
            ["profile", "Профіль"],
            ["notifications", "Сповіщення"],
            ["security", "Безпека"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id as typeof tab)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "profile" && (
          <>
            <div className="profile-heading">
              <Avatar initials="ОП" size="lg" />
              <div>
                <b>{name}</b>
                <small>Викладач · {dept}</small>
              </div>
              <button className="button button-secondary compact-button">
                Змінити фото
              </button>
            </div>
            <div className="form-grid">
              <label>
                Ім’я та прізвище
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>
            <label>
              Кафедра
              <input value={dept} onChange={(e) => setDept(e.target.value)} />
            </label>
            <label>
              Роль
              <select>
                <option>Викладач</option>
                <option>Адміністратор</option>
              </select>
            </label>
          </>
        )}
        {tab === "notifications" && (
          <div className="settings-list">
            <Toggle
              title="Нагадування про перекличку"
              text="За 10 хвилин до початку заняття"
            />
            <Toggle
              title="Запити студентів"
              text="Повідомляти про нові запити на приєднання"
              on
            />
            <Toggle
              title="Щотижневий звіт"
              text="Підсумок відвідуваності щопонеділка"
            />
          </div>
        )}
        {tab === "security" && (
          <div className="security-panel">
            <ShieldCheck size={30} />
            <div>
              <b>Захист акаунта</b>
              <p>Останній вхід: сьогодні о 09:42. Ваш акаунт захищено.</p>
            </div>
            <button
              className="button button-secondary"
              onClick={() => notify("Посилання для зміни пароля надіслано")}
            >
              Змінити пароль
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button className="button button-secondary" onClick={close}>
            Скасувати
          </button>
          <button className="button button-primary" onClick={save}>
            {saved ? "Збережено" : "Зберегти зміни"}
          </button>
        </div>
      </div>
    </div>
  );
}
function CreateLessonForm({
  onCreate,
}: {
  onCreate: (lesson: Lesson) => void;
}) {
  const [title, setTitle] = useState("Основи програмування");
  const [format, setFormat] = useState("Лекція");
  const [pair, setPair] = useState("1 пара");
  const [group, setGroup] = useState("КН-21");
  const [date, setDate] = useState("2024-03-14");
  const [startsAt, setStartsAt] = useState("10:40");
  const [endsAt, setEndsAt] = useState("12:00");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      setError("Введіть назву заняття.");
      return;
    }

    if (startsAt >= endsAt) {
      setError("Час завершення має бути пізніше за час початку.");
      return;
    }

    onCreate({
      id: Date.now(),
      title: title.trim(),
      format,
      pair,
      startsAt,
      endsAt,
      date,
      group,
    });
  };

  return (
    <form className="lesson-form" onSubmit={submit}>
      <label>
        Назва заняття
        <input
          name="lesson-title"
          autoComplete="off"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Наприклад, Основи програмування"
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Дата
          <input
            name="lesson-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label>
          Група
          <select
            name="lesson-group"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option>КН-21</option>
            <option>ПІ-22</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Формат
          <select
            name="lesson-format"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option>Лекція</option>
            <option>Практичне заняття</option>
            <option>Лабораторна робота</option>
          </select>
        </label>
        <label>
          Пара
          <select
            name="lesson-pair"
            value={pair}
            onChange={(event) => setPair(event.target.value)}
          >
            <option>1 пара</option>
            <option>2 пара</option>
            <option>3 пара</option>
            <option>4 пара</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Початок
          <input
            name="lesson-start"
            type="time"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </label>
        <label>
          Завершення
          <input
            name="lesson-end"
            type="time"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary full" type="submit">
        <Plus size={17} />
        Створити заняття
      </button>
    </form>
  );
}

function Toggle({
  title,
  text,
  on = false,
}: {
  title: string;
  text: string;
  on?: boolean;
}) {
  const [active, setActive] = useState(on);
  return (
    <button className="setting-toggle" onClick={() => setActive(!active)}>
      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <i className={active ? "on" : ""}>
        <em />
      </i>
    </button>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button className="modal-close" onClick={close} aria-label="Закрити">
          <X size={18} />
        </button>
        <div className="eyebrow">ВІДМІТКА</div>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
