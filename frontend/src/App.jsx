import { PageLoader } from "./components/ui.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import { matchPath, Redirect, useRouter } from "./router.jsx";
import { homeFor, useAuth } from "./services/auth.jsx";

import Landing from "./pages/public/Landing.jsx";
import HowItWorks from "./pages/public/HowItWorks.jsx";
import Research from "./pages/public/Research.jsx";
import About from "./pages/public/About.jsx";
import Login from "./pages/public/Login.jsx";
import Register from "./pages/public/Register.jsx";
import NotFound from "./pages/public/NotFound.jsx";

import RequesterDashboard from "./pages/requester/Dashboard.jsx";
import FindWorkers from "./pages/requester/FindWorkers.jsx";
import Requests from "./pages/requester/Requests.jsx";
import RequestDetail from "./pages/requester/RequestDetail.jsx";
import RequesterReviews from "./pages/requester/Reviews.jsx";

import WorkerDashboard from "./pages/worker/Dashboard.jsx";
import WorkerProfile from "./pages/worker/Profile.jsx";
import WorkerRequests from "./pages/worker/Requests.jsx";
import WorkerJobs from "./pages/worker/Jobs.jsx";
import WorkerTrust from "./pages/worker/Trust.jsx";
import WorkerRatings from "./pages/worker/Ratings.jsx";
import WorkerPeers from "./pages/worker/Peers.jsx";

import WorkerDetail from "./pages/shared/WorkerDetail.jsx";
import Account from "./pages/shared/Account.jsx";

import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminUsers from "./pages/admin/Users.jsx";
import AdminWorkers from "./pages/admin/Workers.jsx";
import AdminVerifications from "./pages/admin/Verifications.jsx";
import AdminRequests from "./pages/admin/Requests.jsx";
import AdminReviews from "./pages/admin/Reviews.jsx";
import AdminDisputes from "./pages/admin/Disputes.jsx";
import AdminTrust from "./pages/admin/Trust.jsx";
import AdminMatching from "./pages/admin/Matching.jsx";

const R = "requester";
const W = "worker";
const A = "admin";

const ROUTES = [
  { path: "/", page: Landing, layout: "public" },
  { path: "/how-it-works", page: HowItWorks, layout: "public" },
  { path: "/research", page: Research, layout: "public" },
  { path: "/about", page: About, layout: "public" },
  { path: "/login", page: Login, layout: "bare", guestOnly: true },
  { path: "/register", page: Register, layout: "bare", guestOnly: true },

  { path: "/requester", page: RequesterDashboard, roles: [R], title: "Dashboard", crumbs: "Service requester" },
  { path: "/requester/find", page: FindWorkers, roles: [R], title: "Find workers", crumbs: "Service requester" },
  { path: "/requester/requests", page: Requests, roles: [R], title: "Service requests", crumbs: "Service requester" },
  { path: "/requester/requests/:id", page: RequestDetail, roles: [R], title: "Request details", crumbs: "Service requests" },
  { path: "/requester/reviews", page: RequesterReviews, roles: [R], title: "Ratings & feedback", crumbs: "Service requester" },

  { path: "/worker", page: WorkerDashboard, roles: [W], title: "Dashboard", crumbs: "Skilled worker" },
  { path: "/worker/profile", page: WorkerProfile, roles: [W], title: "My profile", crumbs: "Skilled worker" },
  { path: "/worker/requests", page: WorkerRequests, roles: [W], title: "Requests", crumbs: "Skilled worker" },
  { path: "/worker/jobs", page: WorkerJobs, roles: [W], title: "My jobs", crumbs: "Skilled worker" },
  { path: "/worker/trust", page: WorkerTrust, roles: [W], title: "Trust score", crumbs: "Skilled worker" },
  { path: "/worker/ratings", page: WorkerRatings, roles: [W], title: "Ratings", crumbs: "Skilled worker" },
  { path: "/worker/peers", page: WorkerPeers, roles: [W], title: "Endorse peers", crumbs: "Skilled worker" },

  { path: "/workers/:id", page: WorkerDetail, roles: [R, W, A], title: "Worker profile", crumbs: "Workers" },
  { path: "/account", page: Account, roles: [R, W, A], title: "Account", crumbs: "Settings" },

  { path: "/admin", page: AdminDashboard, roles: [A], title: "Dashboard", crumbs: "Administrator" },
  { path: "/admin/users", page: AdminUsers, roles: [A], title: "Users", crumbs: "Administrator" },
  { path: "/admin/workers", page: AdminWorkers, roles: [A], title: "Workers", crumbs: "Administrator" },
  { path: "/admin/verifications", page: AdminVerifications, roles: [A], title: "Verifications", crumbs: "Administrator" },
  { path: "/admin/requests", page: AdminRequests, roles: [A], title: "Requests & jobs", crumbs: "Administrator" },
  { path: "/admin/reviews", page: AdminReviews, roles: [A], title: "Ratings & feedback", crumbs: "Administrator" },
  { path: "/admin/disputes", page: AdminDisputes, roles: [A], title: "Disputes", crumbs: "Administrator" },
  { path: "/admin/trust", page: AdminTrust, roles: [A], title: "Trust metrics", crumbs: "TrueRank engine" },
  { path: "/admin/matching", page: AdminMatching, roles: [A], title: "Matching statistics", crumbs: "TrueRank engine" },
];

export default function App() {
  const { path } = useRouter();
  const { user, ready } = useAuth();

  let route = null;
  let params = {};
  for (const r of ROUTES) {
    const m = matchPath(r.path, path);
    if (m) {
      route = r;
      params = m;
      break;
    }
  }

  if (!route) {
    return (
      <PublicLayout>
        <NotFound />
      </PublicLayout>
    );
  }

  if (!ready) return <PageLoader />;

  const Page = route.page;

  if (route.guestOnly && user) return <Redirect to={homeFor(user)} />;

  if (route.roles) {
    if (!user) return <Redirect to={`/login?next=${encodeURIComponent(path + window.location.search)}`} />;
    if (!route.roles.includes(user.role)) return <Redirect to={homeFor(user)} />;
    return (
      <AppLayout title={route.title} crumbs={route.crumbs}>
        <Page params={params} />
      </AppLayout>
    );
  }

  if (route.layout === "bare") return <Page params={params} />;
  return (
    <PublicLayout>
      <Page params={params} />
    </PublicLayout>
  );
}
