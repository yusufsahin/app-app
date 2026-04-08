import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";
import { Button } from "../../../shared/components/ui";

const TUTORIAL_FILES = {
  en: "USER_TUTORIAL_EN.md",
  tr: "USER_TUTORIAL_TR.md",
} as const;

type TutorialLang = keyof typeof TUTORIAL_FILES;

function isTutorialLang(s: string | undefined): s is TutorialLang {
  return s === "en" || s === "tr";
}

export default function UserTutorialPage() {
  const { orgSlug, lang: langParam } = useParams<{ orgSlug: string; lang: string }>();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!orgSlug) {
    return <Navigate to="/" replace />;
  }
  if (!isTutorialLang(langParam)) {
    return <Navigate to={`/${orgSlug}/help/tutorial/en`} replace />;
  }

  const lang = langParam;

  useEffect(() => {
    let cancelled = false;
    const file = TUTORIAL_FILES[lang];
    setMarkdown(null);
    setError(null);
    fetch(`/docs/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the user guide. Run the app build so tutorials are copied into public/docs.");
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <div className="mx-auto max-w-4xl px-1 pb-12 md:px-2">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/${orgSlug}`}>Back to projects</Link>
        </Button>
        <span className="text-sm text-muted-foreground">Language:</span>
        <div className="flex gap-2">
          <Button variant={lang === "en" ? "secondary" : "ghost"} size="sm" asChild>
            <Link to={`/${orgSlug}/help/tutorial/en`}>English</Link>
          </Button>
          <Button variant={lang === "tr" ? "secondary" : "ghost"} size="sm" asChild>
            <Link to={`/${orgSlug}/help/tutorial/tr`}>Türkçe</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : markdown === null ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span>Loading guide…</span>
        </div>
      ) : (
        <article
          className={[
            "tutorial-markdown text-foreground",
            "space-y-4 text-sm leading-relaxed md:text-base",
            "[&_h1]:scroll-mt-20 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
            "[&_h2]:scroll-mt-20 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold",
            "[&_h4]:mt-4 [&_h4]:font-semibold",
            "[&_p]:text-muted-foreground [&_li]:text-muted-foreground",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:opacity-90",
            "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
            "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-foreground",
            "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:p-4",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
            "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm",
            "[&_th]:border [&_th]:border-border [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-foreground",
            "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
            "[&_hr]:my-8 [&_hr]:border-border",
          ].join(" ")}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
