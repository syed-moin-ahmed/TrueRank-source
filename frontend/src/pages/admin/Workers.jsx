import { useEffect, useState } from "react";
import { LuBriefcase, LuChevronLeft, LuChevronRight, LuSearch } from "react-icons/lu";
import { Bar } from "../../components/charts.jsx";
import { useToast } from "../../components/toast.jsx";
import { Avatar, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonCards, SourceBadge, Toggle } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { put } from "../../services/api.js";
import { pct, rating, score } from "../../utils/format.js";

export default function AdminWorkers() {
  useDocumentTitle("Workers");
  const toast = useToast();
  const filters = useApi("/workers/filters");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [occupation, setOccupation] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("trust");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, error, loading, reload } = useApi("/workers", { search: debounced, occupation, source, sort, page, page_size: 25 });

  const update = async (w, body, label) => {
    try {
      await put(`/admin/workers/${w.id}`, body);
      toast.success(label, w.name);
      reload();
    } catch (e) {
      toast.error("Could not update", e.message);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <PageHeader title="Worker profiles" subtitle={data ? `${data.total.toLocaleString()} profiles` : "All worker profiles in the database"} />
      <Card className="card-flush">
        <div className="row" style={{ padding: 18 }}>
          <div className="input-icon" style={{ flex: 1, minWidth: 220 }}>
            <LuSearch />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, trade or skill" />
          </div>
          <Select value={occupation} onChange={(e) => { setOccupation(e.target.value); setPage(1); }} style={{ width: 200 }} aria-label="Occupation">
            <option value="">All trades</option>
            {filters.data?.occupations.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} style={{ width: 180 }} aria-label="Source">
            <option value="">All sources</option>
            <option value="registered">Registered</option>
            <option value="demo_seed">Demo data</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 170 }} aria-label="Sort">
            <option value="trust">Sort: trust</option>
            <option value="rating">Sort: rating</option>
            <option value="experience">Sort: experience</option>
            <option value="name">Sort: name</option>
            <option value="recent">Sort: newest</option>
          </Select>
        </div>
        {loading && !data && <div style={{ padding: 18 }}><SkeletonCards count={5} height={48} /></div>}
        {error && <div style={{ padding: 18 }}><ErrorState error={error} onRetry={reload} /></div>}
        {data && data.items.length === 0 && <EmptyState icon={LuBriefcase} title="No workers found" />}
        {data && data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Worker</th><th>Source</th><th className="num">Rating</th><th className="num">Completion</th><th style={{ minWidth: 160 }}>Trust score</th><th>Verified</th><th>Available</th></tr>
              </thead>
              <tbody>
                {data.items.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link to={`/workers/${w.id}`} className="row" style={{ "--gap": "10px", flexWrap: "nowrap", color: "inherit" }}>
                        <Avatar name={w.name} gender={w.gender} size="sm" />
                        <div>
                          <div className="strong">{w.name}</div>
                          <div className="tiny muted">{w.occupation} · {w.city}</div>
                        </div>
                      </Link>
                    </td>
                    <td><SourceBadge source={w.source} label={w.source_label} /></td>
                    <td className="num">{rating(w.metrics.average_rating)}</td>
                    <td className="num">{pct(w.metrics.completion_rate)}</td>
                    <td>
                      <div className="row" style={{ "--gap": "8px", flexWrap: "nowrap" }}>
                        <div style={{ flex: 1 }}><Bar value={w.trust_score} tone="trust" thin /></div>
                        <span className="mono small strong">{score(w.trust_score)}</span>
                      </div>
                    </td>
                    <td><Toggle checked={w.is_verified} onChange={(v) => update(w, { is_verified: v }, v ? "Marked verified" : "Verification removed")} /></td>
                    <td><Toggle checked={w.is_available} onChange={(v) => update(w, { is_available: v }, v ? "Worker available" : "Worker hidden from search")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && pages > 1 && (
          <div className="row-between" style={{ padding: 16 }}>
            <span className="small muted">Page {page} of {pages}</span>
            <div className="row">
              <Button size="sm" icon={LuChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" iconRight={LuChevronRight} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
