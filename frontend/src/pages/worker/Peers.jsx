import { useEffect, useState } from "react";
import { LuHandshake, LuSearch } from "react-icons/lu";
import { WorkerRow } from "../../components/truerank.jsx";
import { Card, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonCards } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { pct } from "../../utils/format.js";

export default function WorkerPeers() {
  useDocumentTitle("Endorse peers");
  const me = useApi("/workers/me");
  const filters = useApi("/workers/filters");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [city, setCity] = useState("");
  const [occupation, setOccupation] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (me.data?.profile) {
      setCity(me.data.profile.city);
      setOccupation(me.data.profile.occupation);
    }
  }, [me.data]);

  const list = useApi("/workers", { search: debounced, city, occupation, page_size: 30, sort: "name" });
  const myId = me.data?.profile?.id;

  return (
    <>
      <PageHeader title="Endorse fellow workers" subtitle="Peer endorsements make up 20% of the Composite Trust Score. Open a worker’s profile to endorse them — only workers whose work you know." />
      <Card>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="input-icon" style={{ flex: 1, minWidth: 220 }}>
            <LuSearch />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, trade or skill" />
          </div>
          <div style={{ width: 200 }}>
            <Select value={occupation} onChange={(e) => setOccupation(e.target.value)} aria-label="Occupation">
              <option value="">All trades</option>
              {filters.data?.occupations.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </div>
          <div style={{ width: 170 }}>
            <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
              <option value="">All cities</option>
              {filters.data?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
        {list.loading && <SkeletonCards count={4} height={56} />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.filter((w) => w.id !== myId).length === 0 && <EmptyState icon={LuHandshake} title="No workers found" />}
        <div className="grid grid-2" style={{ "--gap": "0 24px" }}>
          {list.data?.items.filter((w) => w.id !== myId).map((w) => (
            <WorkerRow key={w.id} worker={w} to={`/workers/${w.id}`} right={<span className="chip amber">TS {pct(w.trust_score)}</span>} />
          ))}
        </div>
      </Card>
    </>
  );
}
