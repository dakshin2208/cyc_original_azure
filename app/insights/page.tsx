// /insights — private analytics dashboard.
// Gated by the httpOnly session cookie set when a valid /insights/<token> link is
// opened. No valid cookie → 404 (the page appears not to exist).
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DASHBOARD_COOKIE, isValidSession } from '@/lib/dashboard-auth'
import InsightsDashboard from './dashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Insights',
  robots: { index: false, follow: false },
}

// Runs before any app chunk loads (the HTML is always served fresh via no-store).
// If a JS chunk fails to load — the usual cause of a "blank screen until hard
// refresh" after a dev restart or a redeploy — reload once (throttled) so the page
// self-heals instead of staying blank.
const CHUNK_RELOAD_SNIPPET = `(function(){
  function isChunkErr(m){return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script|Failed to fetch dynamically/i.test(String(m||''));}
  function maybeReload(m){
    if(!isChunkErr(m))return;
    try{var k='__insights_reload_ts__';var last=parseInt(sessionStorage.getItem(k)||'0',10);
      if(Date.now()-last>8000){sessionStorage.setItem(k,String(Date.now()));location.reload();}
    }catch(e){location.reload();}
  }
  window.addEventListener('error',function(e){maybeReload(e&&(e.message||(e.error&&e.error.message)));},true);
  window.addEventListener('unhandledrejection',function(e){maybeReload(e&&e.reason&&(e.reason.message||e.reason));});
})();`

export default function InsightsPage() {
  const cookie = cookies().get(DASHBOARD_COOKIE)?.value
  if (!isValidSession(cookie)) {
    notFound()
  }
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: CHUNK_RELOAD_SNIPPET }} />
      <InsightsDashboard />
    </>
  )
}
