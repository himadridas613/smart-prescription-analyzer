// Hand-written auth session storage for the Supabase client.
// Sessions persist in localStorage; an optional window-level hook can be used to
// synchronize the session across surfaces that embed the app.
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;

  return {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}
