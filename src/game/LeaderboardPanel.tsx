import { useState, useEffect, useCallback } from "react";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Badge from "@cloudscape-design/components/badge";
import { supabase } from "../supabaseClient";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  created_at: string;
}

interface LeaderboardPanelProps {
  refreshTrigger: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPanel({ refreshTrigger }: LeaderboardPanelProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("leaderboard")
      .select("id, name, score, created_at")
      .order("score", { ascending: false })
      .limit(5);
    setLoading(false);
    if (err) {
      setError("Failed to load leaderboard");
    } else {
      setEntries(data ?? []);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard, refreshTrigger]);

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Top 5 all-time scores"
        >
          Leaderboard
        </Header>
      }
    >
      {loading ? (
        <Box textAlign="center" padding="l">
          <Spinner />
        </Box>
      ) : error ? (
        <StatusIndicator type="error">{error}</StatusIndicator>
      ) : entries.length === 0 ? (
        <Box color="text-body-secondary" textAlign="center" padding="m">
          No scores yet — be the first!
        </Box>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: i < entries.length - 1 ? "1px solid var(--color-border-divider-default, #e0e0e0)" : "none",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>
                {i < 3 ? MEDALS[i] : <span style={{ color: "#656871", fontSize: 14, fontWeight: 700 }}>#{i + 1}</span>}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.name}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Badge color={i === 0 ? "green" : "blue"}>{entry.score}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
