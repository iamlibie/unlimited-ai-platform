import { APP_LOGO_TEXT, APP_NAME } from "@/app/config/branding";
import RegisterForm from "./register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            {APP_LOGO_TEXT}
          </div>
          <div className="text-xl font-semibold text-slate-900">{APP_NAME}</div>
          <div className="text-sm text-slate-500">创建你的账号</div>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
