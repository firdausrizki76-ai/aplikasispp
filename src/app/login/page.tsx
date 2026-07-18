'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Map username to email as discussed in the plan
    const email = username.includes('@') ? username : `${username}@sekolah.com`;

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' ? 'Username atau password salah.' : authError.message);
        setIsLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError("Koneksi gagal. Pastikan Environment Variables Vercel sudah disetting.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen bg-white lg:bg-gray-50/50">
      {/* Left Side (Image Background & Copy) */}
      <div 
        className="hidden lg:flex flex-col justify-start w-[55%] p-12 relative overflow-hidden border-r border-green-100/50 bg-green-50/20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://i.ibb.co.com/HfWcTfx2/Whats-App-Image-2026-07-18-at-09-34-41.jpg')" }}
      >
        {/* Background overlay for fading effect */}
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-0"></div>
        
        <div className="relative w-full max-w-2xl mb-10 z-10 pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100/80 backdrop-blur-md text-green-800 font-bold text-sm mb-6 border border-green-200 shadow-sm">
            <span className="material-symbols-outlined text-sm">verified</span>
            Sistem Manajemen Terpadu
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.2] mb-6 tracking-tight drop-shadow-sm">
            SD-SMP <br/>
            <span className="text-primary">Taruna Islam Pekanbaru</span>
          </h1>
          <p className="text-base text-gray-800 font-medium leading-relaxed w-full drop-shadow-sm bg-white/40 p-4 rounded-xl backdrop-blur-sm border border-white/50">
            Motto Sekolah: Disiplin, Berilmu dan Berakhlak Mulia
          </p>
        </div>
      </div>

      {/* Right Side (Login Form) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="bg-white p-10 sm:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100/80 w-full max-w-[460px] relative z-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-primary/20 p-2">
              <img src="https://i.ibb.co.com/p6Cwtnhr/Untitled-July-18-2026-at-09-37-16.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight text-center">
              SD-SMP Taruna Islam Pekanbaru
            </h1>
            <p className="text-gray-500 mt-2 text-center text-sm font-medium">
              Masuk ke akun Anda untuk melanjutkan
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                  person
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-gray-900 placeholder:text-gray-400"
                  placeholder="Masukkan username"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-gray-900 placeholder:text-gray-400"
                  placeholder="Masukkan password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-3 mt-2">
                <span className="material-symbols-outlined text-[20px] text-red-500 shrink-0">
                  error
                </span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              <span>{isLoading ? 'Memproses...' : 'Masuk ke Sistem'}</span>
              {!isLoading && (
                <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Belum memiliki akses? <a href="#" className="font-semibold text-primary hover:text-primary/80">Hubungi Pimpinan</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
