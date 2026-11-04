// Hand-written OAuth sign-in integration built on Supabase Auth (free, open source).
// Requires the Google provider to be enabled in the Supabase dashboard:
// Authentication -> Providers -> Google.
import { supabase } from "../supabase/client";

type OAuthProvider = "google";

type SignInOptions = {
  redirectTo?: string;
  scopes?: string;
};

export const oauth = {
  signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: opts?.redirectTo ?? window.location.origin,
        scopes: opts?.scopes,
        query: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) return { error };

    // Supabase returns the provider consent URL; navigating there completes the sign-in
    // and the user is redirected back to the app with an active session.
    if (data.url) {
      window.location.href = data.url;
      return { redirected: true as const };
    }
    return { redirected: false as const };
  },
};
