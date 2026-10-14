import { useEffect, useState } from "react";
import { LuSearch, LuUsers } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import { Avatar, Card, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonCards, Toggle } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { put } from "../../services/api.js";
import { useAuth } from "../../services/auth.jsx";
import { date } from "../../utils/format.js";

export default function AdminUsers() {
  useDocumentTitle("Users");
  const toast = useToast();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, error, loading, reload } = useApi("/admin/users", { search: debounced, role });

  const toggle = async (u, active) => {
    try {
      await put(`/admin/users/${u.id}/status`, { is_active: active });
      toast.success(active ? "Account activated" : "Account deactivated", u.email);
      reload();
    } catch (e) {
      toast.error("Could not update", e.message);
    }
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Manage requester, worker and admin accounts. Deactivated workers are removed from search results." />
      <Card className="card-flush">
        <div className="row" style={{ padding: 18 }}>
          <div className="input-icon" style={{ flex: 1, minWidth: 220 }}>
            <LuSearch />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" />
          </div>
          <div style={{ width: 200 }}>
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
              <option value="">All roles</option>
              <option value="requester">Requesters</option>
              <option value="worker">Workers</option>
              <option value="admin">Admins</option>
            </Select>
          </div>
        </div>
        {loading && <div style={{ padding: 18 }}><SkeletonCards count={4} height={48} /></div>}
        {error && <div style={{ padding: 18 }}><ErrorState error={error} onRetry={reload} /></div>}
        {data && data.items.length === 0 && <EmptyState icon={LuUsers} title="No users found" />}
        {data && data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>User</th><th>Role</th><th>City</th><th>Joined</th><th>Active</th></tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="row" style={{ "--gap": "10px", flexWrap: "nowrap" }}>
                        <Avatar name={u.name} gender={u.gender} size="sm" />
                        <div>
                          <div className="strong">{u.name}</div>
                          <div className="tiny muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`role-chip role-${u.role}`}>{u.role}</span></td>
                    <td>{u.city || "—"}</td>
                    <td className="nowrap">{date(u.created_at)}</td>
                    <td>{u.id === me.id ? <span className="tiny muted">you</span> : <Toggle checked={Boolean(u.is_active)} onChange={(v) => toggle(u, v)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
