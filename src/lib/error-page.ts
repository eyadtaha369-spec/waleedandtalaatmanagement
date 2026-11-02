export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>تعذر تحميل الصفحة</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; background: #0B132B; color: #f3f4f6; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: #1C2541; border: 1px solid rgba(239,68,68,.4); border-radius: 1rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #D4AF37; }
      p { color: #cbd5e1; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #D4AF37; color: #0B132B; font-weight: 700; }
      .secondary { background: transparent; color: #f3f4f6; border-color: #475569; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>تعذر تحميل الصفحة</h1>
      <p>حدث خطأ من جانبنا. جرّب إعادة المحاولة أو ارجع للصفحة الرئيسية.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">إعادة المحاولة</button>
        <a class="secondary" href="/">الرئيسية</a>
      </div>
    </div>
  </body>
</html>`;
}
