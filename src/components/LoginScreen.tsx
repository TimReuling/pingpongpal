import { t, type Lang } from '@/lib/i18n';
import { lovable } from '@/integrations/lovable';

interface LoginScreenProps {
  lang: Lang;
}

export default function LoginScreen({ lang }: LoginScreenProps) {
  const handleGoogleLogin = async () => {
    await lovable.auth.signInWithOAuth('google');
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-table-green-dark p-6">
      <div className="flex flex-col items-center gap-8 text-center">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-5xl">
            🏓
          </div>
          <h1 className="text-4xl font-black tracking-tight text-primary-foreground">
            PingPong
          </h1>
          <p className="text-lg text-primary-foreground/70 font-medium">
            {t('signInSubtitle', lang)}
          </p>
        </div>

        {/* Sign in button */}
        <button
          onClick={handleGoogleLogin}
          className="flex items-center gap-3 rounded-2xl bg-card px-8 py-4 text-lg font-bold text-card-foreground shadow-lg transition-all duration-200 active:scale-95 hover:shadow-xl"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('signInWith', lang)}
        </button>
      </div>
    </div>
  );
}
