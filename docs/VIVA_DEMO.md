# Viva demonstration script (13 steps)

Start from a fresh database with the demo data, so the numbers match:

```bash
python backend/manage.py init-db
python backend/manage.py seed-demo
python backend/manage.py create-admin --email admin@truerank.local --name "Admin"
python backend/run.py            # open http://127.0.0.1:5000
```

| Step | Do this | Point out |
|---|---|---|
| 1 | **Get started → I am a Skilled Worker**. Register "Ramesh Kumar", city Bengaluru. | No resume or certificate field anywhere. |
| 2 | Profile: Occupation **Electrician**, skills **Wiring, MCB repair, Electrical maintenance, Motor repair**, experience **5**, a description in plain words, one work-history entry. | Trust starts at **0.40**: AR, CR and DA show "Not enough data" (neutral 0.5) and PE = 0. |
| 3 | Log out. Register a **Service Requester**. | Role chosen at registration. |
| 4 | **Find workers**: "I need an electrician to repair damaged wiring and a circuit breaker." City **Bengaluru**. | |
| 5 | Click **Find workers**. | The 7-stage pipeline animates. Each stage's value comes from the backend response. |
| 6 | Open the **Pipeline inspector**. | Tokens → removed stop words → lemmatized terms → TF-IDF vocabulary × profiles → candidates above τ → `R = 0.7·S + 0.3·TS`. |
| 7 | Show the ranked cards. | Three rings (TrueRank, Skill, Trust). The composition bar shows λ·S + (1−λ)·TS. Matched-term contributions add up to S. With the demo data, Ramesh appears at **rank #2**: high skill similarity, low cold-start trust. |
| 8 | **View profile** on Ramesh. | Trust breakdown with weights and evidence. |
| 9 | **Select worker**. Log in as Ramesh → **Requests → Accept**, then **My jobs → Start job**. | Status timeline. |
| 10 | Back as requester: **Mark job as completed**. | Trust is recalculated: CR = 1, DA = 1 → **0.60**. |
| 11 | Give **5★** and written feedback. | The **feedback-loop card** shows 0.60 → **0.80** (AR = 1.0). |
| 12 | Open Ramesh's profile → **Trust history** chart. | Three stored snapshots: profile created → job completed → rating. |
| 13 | Run the same search again. | Ramesh moves from **#2 to #1** because his trust score changed. Nothing about his skills changed. |

Extras for questions:

* **Admin → Matching statistics → λ experiment** ranks the same query at λ = 1.0, 0.7 and 0.0 side by side.
* **Admin → Disputes**: uphold or dismiss a dispute and watch DA change.
* **How it works** page: type any sentence to see preprocessing run live.
* **Research** page: the paper's reported results, clearly labelled as not computed by the website.

> Exact similarity values can differ slightly between NLTK versions (stop-word list / WordNet).
> The trust values (0.40 → 0.60 → 0.80) are exact.
