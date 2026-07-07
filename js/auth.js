// =====================================================================
// Authentification.
//  - Mode réel : Supabase magic link (PKCE) + code OTP 6 chiffres en
//    secours (les scanners d'e-mails pro consomment parfois le lien).
//    L'e-mail détermine le rôle via access_list (RPC get_my_profile) :
//    AUCUN choix de profil côté utilisateur.
//  - Mode démo (sans backend) : sélecteur de profil assumé, marqué DÉMO.
// =====================================================================
import { IS_DEMO } from './config.js';
import { sb } from './api.js';

export async function getProfile(){
  if (IS_DEMO) {
    try { return JSON.parse(sessionStorage.getItem('pulse-demo-profile')) || null; }
    catch { return null; }
  }
  const c = await sb();
  const { data: { session } } = await c.auth.getSession();
  if (!session) return null;
  const { data, error } = await c.rpc('get_my_profile');
  if (error) { console.error(error); return null; }
  const p = Array.isArray(data) ? data[0] : data;
  return p ? { email: p.email, role: p.role, bu: p.bu, name: p.display_name } : { email: session.user.email, role: null };
}

export function setDemoProfile(profile){
  if (profile) sessionStorage.setItem('pulse-demo-profile', JSON.stringify(profile));
  else sessionStorage.removeItem('pulse-demo-profile');
}

export async function emailAllowed(email){
  if (IS_DEMO) return true;
  const { data, error } = await (await sb()).rpc('email_is_allowed', { p_email: email });
  if (error) { console.error(error); return true; } // en cas de doute, laisser Supabase trancher
  return !!data;
}

export async function sendMagicLink(email){
  const c = await sb();
  const redirect = location.origin + location.pathname;
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw error;
}

export async function verifyOtpCode(email, token){
  const c = await sb();
  const { error } = await c.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signOut(){
  if (IS_DEMO) { setDemoProfile(null); return; }
  await (await sb()).auth.signOut();
}

export async function watchAuth(onChange){
  if (IS_DEMO) return;
  const c = await sb();
  c.auth.onAuthStateChange(() => onChange());
}
