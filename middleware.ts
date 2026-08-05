import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasSupabaseAuthCookie,
  isolatePrivateResponse,
  isPrivateAuthPath,
  requiresPrivateResponse,
} from "@/lib/auth/middleware-policy";
import { getAuthModeStatus, getServerEnv, getSupabasePublishableKey } from "@/lib/env/server";

/** Renueva cookies SSR. La autorizacion se valida otra vez en cada ruta privada. */
export async function middleware(request: NextRequest) {
  const status = getAuthModeStatus();
  const response = NextResponse.next({ request: { headers: request.headers } });
  const pathname = request.nextUrl.pathname;

  if (status.mode !== "supabase" || !status.configured) {
    if (isPrivateAuthPath(pathname)) isolatePrivateResponse(response.headers);
    return response;
  }

  const env = getServerEnv();
  const key = getSupabasePublishableKey(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    isolatePrivateResponse(response.headers);
    return response;
  }

  const hadAuthCookie = hasSupabaseAuthCookie(request.cookies.getAll().map(({ name }) => name));
  let wroteCookies = false;
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values: Parameters<SetAllCookies>[0]) {
        if (values.length > 0) wroteCookies = true;
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser valida el JWT con Auth. Nunca se usa getSession para autorizar.
  const { data, error } = await supabase.auth.getUser();
  const authenticated = !error && Boolean(data.user);
  if (requiresPrivateResponse({ pathname, hadAuthCookie, authenticated, wroteCookies })) {
    isolatePrivateResponse(response.headers);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|generated/|images/).*)",
  ],
};
