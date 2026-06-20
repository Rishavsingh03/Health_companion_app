import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  History,
  LogOut,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  Upload
} from "lucide-react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  createSubmission,
  fileUrl,
  getMe,
  getSubmission,
  listSubmissions,
  login,
  logout,
  signup
} from "./api";
import type { SubmissionDetail, SubmissionListItem, User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ user, loading, setUser }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageMessage message="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function FullPageMessage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-paper px-4 py-10 text-ink">
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-sm text-slate-600">
        <Activity className="h-5 w-5 animate-pulse text-teal" />
        {message}
      </div>
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate("/login");
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-emerald-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-3 font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-teal text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span>Health Companion</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-slate-600 sm:inline">{user.email}</span>
              <button className="btn-secondary" type="button" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-6xl gap-3 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This app summarizes prescription information for demo purposes only. It is not medical
            advice. Always verify medicines and dosage with a licensed healthcare professional.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </main>
  );
}

function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = isSignup ? await signup(email, password) : await login(email, password);
      setUser(response.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-teal" />
          <div>
            <h1 className="text-2xl font-semibold">{isSignup ? "Create account" : "Welcome back"}</h1>
            <p className="text-sm text-slate-600">
              {isSignup ? "Start saving prescription summaries." : "View your saved analyses."}
            </p>
          </div>
        </div>

        <form className="space-y-4 rounded-md border border-emerald-100 bg-white p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button className="btn-primary w-full justify-center" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : isSignup ? "Sign up" : "Login"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <Link className="font-medium text-teal hover:underline" to={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Login" : "Create account"}
          </Link>
        </p>
      </div>
    </Shell>
  );
}

function DashboardPage() {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listSubmissions()
      .then((response) => setSubmissions(response.submissions))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Prescription history</h1>
          <p className="mt-1 text-sm text-slate-600">
            Each upload is saved separately with its own Gemini analysis.
          </p>
        </div>
        <Link className="btn-primary" to="/submissions/new">
          <Plus className="h-4 w-4" />
          New analysis
        </Link>
      </div>

      {loading ? <InlineState message="Loading saved analyses..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && submissions.length === 0 ? (
        <div className="rounded-md border border-dashed border-emerald-200 bg-white p-8 text-center">
          <History className="mx-auto h-8 w-8 text-teal" />
          <h2 className="mt-3 font-semibold">No prescriptions yet</h2>
          <p className="mt-1 text-sm text-slate-600">Upload one to generate your first saved summary.</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {submissions.map((submission) => (
          <Link
            className="group rounded-md border border-emerald-100 bg-white p-4 transition hover:border-teal hover:shadow-sm"
            key={submission.id}
            to={`/submissions/${submission.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal" />
                  <h2 className="font-medium group-hover:text-teal">{submission.file.originalName}</h2>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{submission.symptoms}</p>
              </div>
              <StatusBadge status={submission.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>{submission.summary}</span>
              <span>{formatDate(submission.createdAt)}</span>
              <span>{formatBytes(submission.file.size)}</span>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

function NewSubmissionPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [symptoms, setSymptoms] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (files.length === 0) {
      setError("Please choose at least one prescription file");
      return;
    }

    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    const imageFiles = files.filter((file) => file.type === "image/jpeg" || file.type === "image/png");

    if (pdfFiles.length > 0 && files.length > 1) {
      setError("Upload either one PDF or up to 5 image pages, not both.");
      return;
    }

    if (pdfFiles.length === 0 && imageFiles.length !== files.length) {
      setError("Only JPG, PNG, and PDF files are supported.");
      return;
    }

    if (imageFiles.length > 5) {
      setError("Upload a maximum of 5 image pages.");
      return;
    }

    const formData = new FormData();
    files.forEach((selectedFile) => {
      formData.append("prescriptions", selectedFile);
    });
    formData.append("symptoms", symptoms);
    setSubmitting(true);

    try {
      const response = await createSubmission(formData);
      navigate(`/submissions/${response.submission.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <div className="mb-6">
        <Link className="text-sm font-medium text-teal hover:underline" to="/">
          Back to history
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">New prescription analysis</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a JPG, PNG, or PDF prescription and add symptoms or concerns.
        </p>
      </div>

      <form className="grid gap-5 rounded-md border border-emerald-100 bg-white p-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="label">Prescription file</span>
          <input
            className="input file:mr-4 file:rounded-md file:border-0 file:bg-mint file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            required
          />
          <span className="mt-2 block text-xs text-slate-500">
            Upload one PDF, or up to 5 JPG/PNG image pages. Maximum size: 5 MB per file.
          </span>
          {files.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {files.map((selectedFile, index) => (
                <li key={`${selectedFile.name}-${index}`}>
                  Page/file {index + 1}: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </li>
              ))}
            </ul>
          ) : null}
        </label>

        <label className="block">
          <span className="label">Symptoms or health concerns</span>
          <textarea
            className="input min-h-36 resize-y"
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            maxLength={2000}
            required
          />
        </label>

        {error ? <ErrorState message={error} /> : null}

        <button className="btn-primary w-fit" type="submit" disabled={submitting}>
          <Upload className="h-4 w-4" />
          {submitting ? "Analyzing..." : "Analyze prescription"}
        </button>
      </form>
    </Shell>
  );
}

function SubmissionDetailPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    getSubmission(id)
      .then((response) => setSubmission(response.submission))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load analysis"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Shell>
        <InlineState message="Loading analysis..." />
      </Shell>
    );
  }

  if (error || !submission) {
    return (
      <Shell>
        <ErrorState message={error || "Submission not found"} />
      </Shell>
    );
  }

  const analysis = submission.aiAnalysis;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm font-medium text-teal hover:underline" to="/">
            Back to history
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">{submission.file.originalName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(submission.createdAt)} · {submission.summary} · {submission.extractionMode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(submission.files && submission.files.length > 0 ? submission.files : [{ ...submission.file, index: 0 }]).map(
            (file) => (
              <a
                className="btn-secondary"
                href={fileUrl(submission.id, file.index)}
                key={`${file.originalName}-${file.index}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4" />
                {submission.files && submission.files.length > 1 ? `Page ${file.index + 1}` : "Original file"}
              </a>
            )
          )}
        </div>
      </div>

      {submission.status === "failed" ? (
        <ErrorState message={submission.errorMessage || "Analysis failed"} />
      ) : null}

      {analysis ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-md border border-emerald-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal" />
              <h2 className="font-semibold">Summary</h2>
            </div>
            <p className="text-sm leading-6 text-slate-700">{analysis.patientSummary}</p>

            <h3 className="mt-6 font-semibold">Medicines</h3>
            <div className="mt-3 grid gap-3">
              {analysis.medicines.length > 0 ? (
                analysis.medicines.map((medicine, index) => (
                  <div className="rounded-md border border-slate-200 p-4" key={`${medicine.name}-${index}`}>
                    <div className="flex items-center gap-2 font-medium">
                      <Pill className="h-4 w-4 text-coral" />
                      {medicine.name}
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <InfoTerm label="Dosage" value={medicine.dosage||"Not Specified"} />
                      <InfoTerm label="Schedule" value={medicine.schedule||"Not Specified"} />
                      <InfoTerm label="Duration" value={medicine.duration || "Not specified"} />
                      <InfoTerm label="Instructions" value={medicine.instructions || "Not specified"} />
                    </dl>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No medicines were confidently detected.</p>
              )}
            </div>
          </section>

          <aside className="grid gap-5">
            <ListSection title="Doctor advice" items={analysis.doctorAdvice} />
            <ListSection title="Recognized conditions" items={analysis.recognizedConditions} />
            <ListSection title="Lifestyle suggestions" items={analysis.lifestyleRecommendations} />
            <ListSection title="Warnings" items={analysis.warnings} tone="warning" />
            <ListSection title="Uncertainty notes" items={analysis.uncertaintyNotes} />
          </aside>
        </div>
      ) : null}
    </Shell>
  );
}

function InfoTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ListSection({
  title,
  items,
  tone = "default"
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
}) {
  return (
    <section className="rounded-md border border-emerald-100 bg-white p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {items.length > 0 ? (
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((item, index) => (
            <li className="flex gap-2" key={`${title}-${index}`}>
              <span className={tone === "warning" ? "text-coral" : "text-teal"}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">None listed.</p>
      )}
    </section>
  );
}

function InlineState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-white p-4 text-sm text-slate-600">
      <Activity className="h-4 w-4 animate-pulse text-teal" />
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function StatusBadge({ status }: { status: SubmissionListItem["status"] }) {
  const classes = {
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    processing: "bg-sky-50 text-sky-700 ring-sky-200",
    failed: "bg-red-50 text-red-700 ring-red-200"
  };

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${classes[status]}`}>
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submissions/new"
          element={
            <ProtectedRoute>
              <NewSubmissionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submissions/:id"
          element={
            <ProtectedRoute>
              <SubmissionDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
