import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

/** بطاقة خطأ عربية بدل شاشة "This page didn't load". */
export function ErrorCard({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    <div dir="rtl" className="mx-auto mt-10 max-w-md rounded-2xl border border-[#EF4444]/40 bg-[#1C2541] p-6 text-center text-foreground shadow-lg" role="alert">
      <div className="text-3xl">⚠️</div>
      <h2 className="mt-2 text-lg font-extrabold text-[#D4AF37]">حدث خطأ غير متوقع في عرض هذه الصفحة</h2>
      <p className="mt-2 text-sm text-muted-foreground">لم تتأثر بياناتك. يمكنك إعادة المحاولة، وإن تكرر الخطأ فحدّث الصفحة أو ارجع للرئيسية.</p>
      {detail && <p className="mt-3 break-words rounded-lg bg-[#0B132B] p-2 text-left text-xs text-muted-foreground" dir="ltr">{detail}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className="rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-bold text-[#0B132B] hover:opacity-90">
          إعادة المحاولة
        </button>
        <a href="/" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary/40">
          الرئيسية
        </a>
      </div>
    </div>
  );
}

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}
interface State {
  error: unknown;
  failed: boolean;
}

class Boundary extends Component<Props, State> {
  override state: State = { error: null, failed: false };
  static getDerivedStateFromError(error: unknown): State {
    return { error, failed: true };
  }
  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  retry = () => {
    this.setState({ error: null, failed: false });
    this.props.onRetry?.();
  };
  override render() {
    if (this.state.failed) return <ErrorCard error={this.state.error} onRetry={this.retry} />;
    return this.props.children;
  }
}

/** يغلّف محتوى الصفحة؛ «إعادة المحاولة» تعيد جلب بيانات المسار وتعيد الرسم. */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <Boundary onRetry={() => router.invalidate()}>{children}</Boundary>;
}
