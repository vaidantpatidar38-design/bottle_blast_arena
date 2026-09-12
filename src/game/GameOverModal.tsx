import { useState, useEffect } from "react";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { supabase } from "../supabaseClient";

interface GameOverModalProps {
  score: number;
  visible: boolean;
  onPlayAgain: () => void;
  onScoreSubmitted: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function GameOverModal({ score, visible, onPlayAgain, onScoreSubmitted }: GameOverModalProps) {
  const [name, setName] = useState("");
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tier = score >= 60 ? "high" : "low";

  useEffect(() => {
    if (!visible) return;
    setGifLoading(true);
    setGifUrl(null);
    setSubmitted(false);
    setSubmitError(null);
    setName("");

    fetch(`${SUPABASE_URL}/functions/v1/reaction-gif?tier=${tier}`, {
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then((r) => r.json())
      .then((data) => setGifUrl(data.url ?? null))
      .catch(() => setGifUrl(null))
      .finally(() => setGifLoading(false));
  }, [visible, tier]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.from("leaderboard").insert({ name: name.trim(), score });
    setSubmitting(false);
    if (error) {
      setSubmitError("Couldn't save your score. Try again!");
    } else {
      setSubmitted(true);
      onScoreSubmitted();
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onPlayAgain}
      header={
        <span style={{ fontSize: 22, fontWeight: 800, color: score >= 60 ? "#00802f" : "#c0392b" }}>
          {score >= 60 ? "Amazing Shot!" : "Game Over!"}
        </span>
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onPlayAgain}>
              Play Again
            </Button>
            {!submitted && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={!name.trim() || submitted}
              >
                Submit Score
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {/* Score display */}
        <Box textAlign="center">
          <div style={{ fontSize: 14, color: "#656871", fontWeight: 600, marginBottom: 4 }}>Final Score</div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              lineHeight: 1,
              color: score >= 60 ? "#00802f" : "#e74c3c",
              textShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            {score}
          </div>
          {score >= 60 && (
            <div style={{ fontSize: 14, color: "#856400", marginTop: 4, fontWeight: 600 }}>
              +50 All Bottles Bonus!
            </div>
          )}
        </Box>

        {/* GIF */}
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            background: "#f0f0f0",
            minHeight: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {gifLoading ? (
            <Spinner size="large" />
          ) : gifUrl ? (
            <img
              src={gifUrl}
              alt="reaction"
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
            />
          ) : (
            <Box color="text-body-secondary" textAlign="center" padding="l">
              {score >= 60 ? "Great job!" : "Better luck next time!"}
            </Box>
          )}
        </div>

        {/* Name entry */}
        {!submitted ? (
          <FormField label="Your name" errorText={submitError ?? undefined}>
            <Input
              value={name}
              onChange={(e) => setName(e.detail.value)}
              placeholder="Enter your name..."
              onKeyDown={(e) => {
                if (e.detail.key === "Enter" && name.trim()) handleSubmit();
              }}
            />
          </FormField>
        ) : (
          <Box textAlign="center" color="text-status-success">
            Score submitted! Check the leaderboard.
          </Box>
        )}
      </SpaceBetween>
    </Modal>
  );
}
