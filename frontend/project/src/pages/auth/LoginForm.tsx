import { useState, type FormEvent } from 'react';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { InputField } from './InputField';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { ApiError } from '../../lib/api';

export function LoginForm() {
  const { login } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const uErr = username.trim() ? null : t('auth.usernameRequired');
    const pErr = password ? null : t('auth.passwordRequired');
    setUsernameError(uErr);
    setPasswordError(pErr);
    if (uErr || pErr) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      <InputField
        icon={<User className="h-4 w-4" />}
        name="username"
        autoComplete="username"
        placeholder={t('auth.username')}
        value={username}
        onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(null); }}
        error={usernameError}
      />
      <InputField
        icon={<Lock className="h-4 w-4" />}
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder={t('auth.password')}
        value={password}
        onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
        error={passwordError}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            className="grid h-6 w-6 place-items-center rounded-lg text-ink-400 transition-colors hover:text-brand-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      {formError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-700">{formError}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:from-brand-400 hover:to-brand-600 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t('auth.signingIn')}
          </>
        ) : (
          t('auth.signIn')
        )}
      </button>
    </form>
  );
}
