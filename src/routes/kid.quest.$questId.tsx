import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { SuccessState } from "@/components/SuccessState";
import { getKidSession } from "@/lib/kid-session";
import { isKidBypassed } from "@/lib/admin-bypass";
import {
  edgeKidQuestStart,
  edgeKidQuestAnswer,
  extractEdgeErrorMessage,
} from "@/lib/edge";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import { usePenny } from "@/features/penny";

export const Route = createFileRoute("/kid/quest/$questId")({
  head: () => ({ meta: [{ title: "Quest | Centsibility" }] }),
  component: KidQuestRunnerPage,
});

interface QuestionData {
  id: string;
  position: number;
  prompt: string;
  choices: string[];
}

interface AnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
  done: boolean;
  correctCount: number;
  total: number;
  passed?: boolean;
  pointsAwarded?: number;
  firstCompletion?: boolean;
}

function KidQuestRunnerPage() {
  const { questId } = Route.useParams();
  const navigate = useNavigate();
  const { openPenny, setPageContext } = usePenny();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string>("");
  const [questTitle, setQuestTitle] = useState<string>("");
  const [questPoints, setQuestPoints] = useState<number>(400);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [showFinished, setShowFinished] = useState(false);

  const startQuest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedChoice(null);
    setAnswerResult(null);
    setShowFinished(false);
    setCurrentIndex(0);

    const session = getKidSession();
    const code = session?.code || (isKidBypassed() ? "demo-code" : "");

    if (!code) {
      setError("Please sign in to take this quest.");
      setLoading(false);
      return;
    }

    try {
      const res = await edgeKidQuestStart({ code, questId });
      setAttemptId(res.attemptId);
      setQuestTitle(res.quest?.title || "Quest");
      setQuestPoints(res.quest?.points || 400);
      setQuestions(res.questions || []);
    } catch (err) {
      setError(await extractEdgeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [questId]);

  useEffect(() => {
    void startQuest();
  }, [startQuest]);

  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (currentQ) {
      if (answerResult) {
        const picked = selectedChoice !== null ? currentQ.choices[selectedChoice] : "";
        const correct = currentQ.choices[answerResult.correctIndex] ?? "";
        const detail = `${questTitle} - Q: ${currentQ.prompt}. Picked: ${picked}. Correct: ${correct}. Choices: ${currentQ.choices.join(", ")}`.slice(0, 600);
        setPageContext({ page: "Quest", detail });
      } else {
        const detail = `${questTitle} - Q: ${currentQ.prompt}. Choices: ${currentQ.choices.join(", ")}`.slice(0, 600);
        setPageContext({ page: "Quest", detail });
      }
    }
    return () => setPageContext(null);
  }, [questions, currentIndex, answerResult, selectedChoice, questTitle, setPageContext]);

  const handleSelectChoice = async (choiceIndex: number) => {
    if (submitting || answerResult) return;
    setSelectedChoice(choiceIndex);
    setSubmitting(true);
    sfx.tap();

    const session = getKidSession();
    const code = session?.code || (isKidBypassed() ? "demo-code" : "");
    const currentQ = questions[currentIndex];

    try {
      const res = await edgeKidQuestAnswer({
        code,
        attemptId,
        questionId: currentQ.id,
        selectedIndex: choiceIndex,
      });

      setAnswerResult(res);
      if (res.correct) {
        sfx.success();
      } else {
        sfx.error();
      }
    } catch (err) {
      toast.error(await extractEdgeErrorMessage(err));
      setSelectedChoice(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    sfx.tap();
    if (!answerResult) return;

    if (answerResult.done) {
      setShowFinished(true);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedChoice(null);
    setAnswerResult(null);
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-4">
        <Skeleton style={{ height: "3rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "14rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <Card variant="soft" className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-pink)] text-[var(--error)] flex items-center justify-center mx-auto">
            <AppIcon name="lock" size={24} />
          </div>
          <h2 className="text-base font-bold text-[var(--ink)] m-0">{error}</h2>
          <Button
            type="button"
            variant="primary"
            onClick={() => void navigate({ to: "/kid/missions" })}
          >
            Back to Missions
          </Button>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;

  // Completion screen
  if (showFinished && answerResult) {
    const passed = Boolean(answerResult.passed);
    const firstCompletion = Boolean(answerResult.firstCompletion);

    return (
      <div className="max-w-xl mx-auto py-8 space-y-6">
        <Card variant="default" className="p-6 border border-[var(--border)] text-center space-y-4">
          {passed ? (
            <div className="space-y-4">
              <SuccessState
                title={firstCompletion ? "Quest Complete! 🎉" : "Practice Complete! 🌟"}
                detail={
                  firstCompletion
                    ? `Awesome! You scored ${answerResult.correctCount} of ${answerResult.total}. +${answerResult.pointsAwarded || questPoints} points added to your balance!`
                    : `Well done! You scored ${answerResult.correctCount} of ${answerResult.total}. You already claimed points for this quest, but practice makes perfect!`
                }
                buttonText="Back to Missions"
                onAction={() => void navigate({ to: "/kid/missions" })}
              />
              {firstCompletion && (
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      sfx.tap();
                      openPenny({
                        prompt: `I just finished the quest "${questTitle}"!`,
                        context: {
                          page: "Quest",
                          detail: `${questTitle} completed successfully`,
                        },
                      });
                    }}
                    className="min-w-[140px] flex items-center justify-center gap-1.5"
                  >
                    <AppIcon name="penny" size={16} />
                    Tell Penny
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4" role="status">
              <div className="w-16 h-16 rounded-full bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center mx-auto">
                <AppIcon name="trend" size={32} />
              </div>
              <h2 className="text-xl font-extrabold text-[var(--ink)] m-0">
                Almost There!
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto m-0">
                You got {answerResult.correctCount} out of {answerResult.total} correct. You need at least 60% to pass this quest.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void startQuest()}
                >
                  Try Again
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void navigate({ to: "/kid/missions" })}
                >
                  Back to Missions
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (!currentQ) {
    return null;
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 py-2 pb-12">
      {/* Top Navigation & Progress */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/kid/missions"
          onClick={() => sfx.tap()}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--ink)] no-underline"
        >
          <AppIcon name="back" size={16} />
          Missions
        </Link>
        <span className="text-xs font-bold text-[var(--primary-text)] bg-[var(--surface-pink)] px-3 py-1 rounded-full">
          Question {currentIndex + 1} of {totalQ}
        </span>
      </div>

      {/* Quest Title Card */}
      <div className="space-y-1">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider m-0">
          {questTitle}
        </p>
        <div className="w-full bg-[var(--surface-muted)] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[var(--primary)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.round(((currentIndex + 1) / totalQ) * 100)}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card variant="default" className="p-5 sm:p-6 border border-[var(--border)] space-y-5">
        <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] leading-snug m-0">
          {currentQ.prompt}
        </h2>

        {/* Choice Buttons */}
        <div className="space-y-2.5" role="radiogroup" aria-label="Choices">
          {currentQ.choices.map((choiceText, idx) => {
            const isSelected = selectedChoice === idx;
            const hasGraded = answerResult !== null;
            const isCorrectIndex = answerResult?.correctIndex === idx;

            let buttonStyle = "bg-white border-[var(--border)] hover:border-[var(--primary)] text-[var(--ink)]";

            if (hasGraded) {
              if (isCorrectIndex) {
                buttonStyle = "bg-[var(--success-soft)] border-[var(--success)] text-[var(--ink)] font-bold shadow-sm";
              } else if (isSelected && !isCorrectIndex) {
                buttonStyle = "bg-[var(--surface-pink)] border-[var(--error)] text-[var(--ink)]";
              } else {
                buttonStyle = "bg-white/70 border-transparent opacity-60 text-[var(--text-muted)]";
              }
            } else if (isSelected) {
              buttonStyle = "bg-[var(--surface-pink)] border-[var(--primary)] text-[var(--ink)]";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={submitting || hasGraded}
                onClick={() => void handleSelectChoice(idx)}
                aria-pressed={isSelected}
                className={`w-full p-4 rounded-xl border text-left text-sm transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${buttonStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[var(--surface-soft)] font-bold text-xs flex items-center justify-center shrink-0 text-[var(--ink)]">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="leading-snug">{choiceText}</span>
                </div>
                {hasGraded && (
                  <span className="shrink-0">
                    {isCorrectIndex ? (
                      <span className="text-[var(--success)] font-bold flex items-center gap-1 text-xs">
                        <AppIcon name="check" size={16} /> Correct
                      </span>
                    ) : isSelected ? (
                      <span className="text-[var(--error)] font-bold flex items-center gap-1 text-xs">
                        <AppIcon name="close" size={16} /> Wrong
                      </span>
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Penny Explanation Bubble */}
        {answerResult && (
          <div className="p-4 rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)] space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary-text)]">
              <AppIcon name="penny" size={16} />
              <span>Penny says</span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--ink)] leading-relaxed m-0">
              {answerResult.explanation}
            </p>
            {!answerResult.correct && (() => {
              const picked = selectedChoice !== null ? currentQ.choices[selectedChoice] : "";
              const correct = currentQ.choices[answerResult.correctIndex] ?? "";
              let query = `I got this quest question wrong: "${currentQ.prompt}". I picked "${picked}". The answer is "${correct}". Can you explain it for my age?`;
              if (query.length > 900) {
                query = query.slice(0, 897) + "...";
              }
              return (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.tap();
                      const detail = `${questTitle} - Q: ${currentQ.prompt}. Picked: ${picked}. Correct: ${correct}. Choices: ${currentQ.choices.join(", ")}`.slice(0, 600);
                      openPenny({
                        prompt: query,
                        context: { page: "Quest", detail },
                      });
                    }}
                    className="text-xs font-bold text-[var(--primary-hover)] hover:underline inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer"
                  >
                    <AppIcon name="chat" size={14} />
                    Ask Penny why →
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Action Button */}
        {answerResult && (
          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              className="w-full justify-center min-h-[48px] text-sm font-bold"
            >
              {answerResult.done ? "See Quest Results →" : "Next Question →"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
