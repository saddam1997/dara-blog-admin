import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Posts = lazy(() => import("./pages/Posts.jsx"));
const PostEdit = lazy(() => import("./pages/PostEdit.jsx"));
const Revisions = lazy(() => import("./pages/Revisions.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Media = lazy(() => import("./pages/Media.jsx"));
const Comments = lazy(() => import("./pages/Comments.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const UserEdit = lazy(() => import("./pages/UserEdit.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Activity = lazy(() => import("./pages/Activity.jsx"));
const Tools = lazy(() => import("./pages/Tools.jsx"));
const NewsletterSubscribers = lazy(() => import("./pages/NewsletterSubscribers.jsx"));
const NewsletterCampaigns = lazy(() => import("./pages/NewsletterCampaigns.jsx"));

function Gate({ cap, children }) {
  const { can } = useAuth();
  if (cap && !can(cap)) {
    return (
      <div className="wrap">
        <h1 className="page-title">Sorry, you are not allowed to access this page.</h1>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { user, can } = useAuth();
  if (!user) return <Login />;
  // Subscribers have no dashboard — send them to their profile (like WordPress).
  const home = can("edit_posts") ? <Dashboard /> : <Navigate to="/profile" replace />;
  return (
    <Suspense fallback={<div className="loading-screen">Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={home} />
          <Route path="activity" element={<Gate cap="view_activity"><Activity /></Gate>} />
          <Route path="posts" element={<Gate cap="edit_posts"><Posts /></Gate>} />
          <Route path="posts/new" element={<Gate cap="edit_posts"><PostEdit key="new" /></Gate>} />
          <Route path="posts/:id" element={<Gate cap="edit_posts"><PostEdit /></Gate>} />
          <Route path="posts/:id/revisions" element={<Gate cap="edit_posts"><Revisions /></Gate>} />
          <Route path="categories" element={<Gate cap="manage_categories"><Terms key="category" type="category" /></Gate>} />
          <Route path="tags" element={<Gate cap="edit_posts"><Terms key="tag" type="tag" /></Gate>} />
          <Route path="media" element={<Gate cap="upload_files"><Media /></Gate>} />
          <Route path="media/new" element={<Gate cap="upload_files"><Media uploadOnly /></Gate>} />
          <Route path="comments" element={<Gate cap="edit_posts"><Comments /></Gate>} />
          <Route path="newsletter" element={<Gate cap="manage_newsletter"><NewsletterSubscribers /></Gate>} />
          <Route path="newsletter/campaigns" element={<Gate cap="manage_newsletter"><NewsletterCampaigns /></Gate>} />
          <Route path="users" element={<Gate cap="list_users"><Users /></Gate>} />
          <Route path="users/new" element={<Gate cap="create_users"><UserEdit key="new" isNew /></Gate>} />
          <Route path="users/:id" element={<Gate cap="edit_users"><UserEdit /></Gate>} />
          <Route path="profile" element={<UserEdit key="profile" profile />} />
          <Route path="tools" element={<Gate cap="manage_options"><Tools /></Gate>} />
          <Route path="settings/:tab" element={<Gate cap="manage_options"><Settings /></Gate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
