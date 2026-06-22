# Build order and rationale

The order code was written in, and why it minimizes risk. The principle: **build the
hardest-to-fake, highest-uncertainty layer first**, prove it with real output, and only
then wrap presentation around it. The thing most likely to sink this project is the ML
being wrong or unconvincing — so it went first.

| # | Step | Why here |
| --- | --- | --- |
| 1 | **Data generator** | Everything depends on data that looks real. A separable dataset produces fake metrics; this had to be right before anything trained on it. We iterated here until metrics were believable. |
| 2 | **Feature pipeline** | The contract shared by training and serving. Fixing it early eliminates training/serving skew for the rest of the project. |
| 3 | **Training + calibration + SHAP** | The core differentiator and the riskiest claim ("exact explanations"). Proven by probing the model with hand-built transactions and confirming it flags fraud for the *right* reasons. |
| 4 | **Graph + sanctions + scorer + narrative** | The remaining ML signals, composed into one assessment. Verified end-to-end on the demo scenarios before any HTTP existed. |
| 5 | **FastAPI service** | Thin HTTP wrapper over proven logic. Low risk once the logic works. |
| 6 | **Express gateway (auth, RBAC, audit, orchestration)** | The trust boundary. Built against the working ML service so each route was verified against real scores immediately. |
| 7 | **Seed** | Populates a realistic queue on boot, making the whole system demoable without manual data entry. |
| 8 | **React console** | Built last, against a fully working API. The UI never had to be developed against mocks, so what you see is real data throughout. |
| 9 | **Docs** | Written after the system existed, so they describe what is actually true. |

## Why not UI-first

Building the UI first is the classic trap: it produces something that *looks* finished
while the part that's actually hard (and actually judged) — the model and its
explanations — remains unproven. By the time the UI rendered its first screen here, the
score, SHAP attribution, graph, sanctions match, and brief for every demo scenario had
already been verified at the command line. The UI is a faithful view of a system that was
already correct.

## What this ordering bought us

A concrete, mid-build example: the first trained model scored the flagship mule scenario
as **low risk** because the synthetic data had accidentally taught it that draining an
account to zero was *legitimate*. Because the model was built and probed before any UI
existed, this was caught and fixed at the data layer (three iterations on
`synthetic.py`) — not discovered on stage. Building presentation-first would have hidden
this behind a polished screen showing a confidently wrong answer.
