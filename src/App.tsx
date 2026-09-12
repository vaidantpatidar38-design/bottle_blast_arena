import { useState, useCallback } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Grid from "@cloudscape-design/components/grid";
import GameCanvas from "./game/GameCanvas";
import GameOverModal from "./game/GameOverModal";
import LeaderboardPanel from "./game/LeaderboardPanel";

export default function App() {
  const [gameKey, setGameKey] = useState(0);
  const [gameOverScore, setGameOverScore] = useState<number | null>(null);
  const [leaderboardTick, setLeaderboardTick] = useState(0);

  const handleGameOver = useCallback((score: number) => {
    setGameOverScore(score);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameOverScore(null);
    setGameKey((k) => k + 1);
  }, []);

  const handleScoreSubmitted = useCallback(() => {
    setLeaderboardTick((t) => t + 1);
  }, []);

  return (
    <AppLayout
      navigationHide
      toolsHide
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Pull back the catapult and knock down all 6 bottles to score big!"
              actions={
                <Button
                  iconName="refresh"
                  onClick={handlePlayAgain}
                  variant="normal"
                >
                  New Game
                </Button>
              }
            >
              PitchPop
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Grid
              gridDefinition={[
                { colspan: { default: 12, s: 8 } },
                { colspan: { default: 12, s: 4 } },
              ]}
            >
              {/* Game canvas */}
              <div>
                <GameCanvas
                  gameKey={gameKey}
                  onGameOver={handleGameOver}
                  onReset={handlePlayAgain}
                />
                <GameOverModal
                  score={gameOverScore ?? 0}
                  visible={gameOverScore !== null}
                  onPlayAgain={handlePlayAgain}
                  onScoreSubmitted={handleScoreSubmitted}
                />
              </div>

              {/* Sidebar */}
              <SpaceBetween size="l">
                <LeaderboardPanel refreshTrigger={leaderboardTick} />
                <Box>
                  <Box variant="h3" padding={{ bottom: "xs" }}>How to Play</Box>
                  <Box color="text-body-secondary" fontSize="body-s">
                    <SpaceBetween size="xxs">
                      <div>1. Click and drag the catapult arm back to aim</div>
                      <div>2. A trajectory preview shows where the ball will go</div>
                      <div>3. Release to fire — knock down all 6 bottles!</div>
                      <div>4. +10 pts per bottle, +50 bonus for clearing all in one shot</div>
                      <div>5. You get 5 shots per game</div>
                    </SpaceBetween>
                  </Box>
                </Box>
              </SpaceBetween>
            </Grid>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
