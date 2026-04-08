import { Navigate, useParams } from "react-router-dom";

type TutorialLang = "en" | "tr";

function isTutorialLang(s: string | undefined): s is TutorialLang {
  return s === "en" || s === "tr";
}

export default function UserTutorialPage() {
  const { orgSlug, lang: langParam } = useParams<{ orgSlug: string; lang: string }>();

  if (!orgSlug) {
    return <Navigate to="/" replace />;
  }
  if (!isTutorialLang(langParam)) {
    return <Navigate to={`/${orgSlug}/help/tutorial/en`} replace />;
  }

  const lang = langParam.toUpperCase() as "EN" | "TR";
  const htmlSrc = `/docs/USER_TUTORIAL_${lang}.html`;

  return (
    <iframe
      src={htmlSrc}
      title="User Guide"
      className="block w-full border-0 h-[calc(100vh-57px)]"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
    />
  );
}
