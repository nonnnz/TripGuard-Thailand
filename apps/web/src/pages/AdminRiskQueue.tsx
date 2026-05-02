import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { getRiskFlags, queryKeys } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const sevTone: Record<string, string> = {
  high: "bg-destructive-soft text-destructive",
  medium: "bg-warning-soft text-warning",
  low: "bg-trust-soft text-trust",
};

const statusTone: Record<string, string> = {
  open: "bg-destructive-soft text-destructive",
  in_review: "bg-warning-soft text-warning",
  resolved: "bg-trust-soft text-trust",
};

export default function AdminRiskQueue() {
  const flags = useQuery({
    queryKey: queryKeys.riskFlags,
    queryFn: getRiskFlags,
  });

  return (
    <PageShell>
      <section className="container py-8 md:py-12">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Admin · Risk queue
          </p>
          <h1 className="mt-1 text-3xl font-[650] tracking-tight md:text-4xl">
            Open risk flags
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Triage high-risk places and disputes. Compact, action-focused view.
          </p>
        </header>

        <div className="overflow-hidden rounded-card border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Place</th>
                <th className="px-4 py-3 font-medium">Province</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 text-right font-medium font-mono">
                  Reports
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.data?.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-border hover:bg-surface-soft/50"
                >
                  <td className="px-4 py-3 font-semibold">
                    {f.placeName}
                    <div className="text-xs text-muted-foreground font-mono">
                      {f.placeId}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.province}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        sevTone[f.severity],
                      )}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.reason}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {f.reportsCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        statusTone[f.status],
                      )}
                    >
                      {f.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
