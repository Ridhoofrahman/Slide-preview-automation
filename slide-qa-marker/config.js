// Fill these in once. Both the PowerPoint add-in and the review page read this file.
// Supabase → Project Settings → API: copy "Project URL" and the "anon public" key.
// The anon key is designed to be public; data stays private because every table
// and the image bucket only allow signed-in team members.
window.SLIDE_REVIEW_CONFIG = {
  SUPABASE_URL: "",        // e.g. "https://abcdefghijk.supabase.co"
  SUPABASE_ANON_KEY: "",   // long key starting with "eyJ..."
  REVIEW_PAGE_URL: "",     // e.g. "https://YOUR-GITHUB-USERNAME.github.io/slide-qa-marker/review.html"
  DAYS_TO_SHOW: 21         // review page shows slides sent in the last N days
};
