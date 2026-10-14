# Research dataset

Place the research CSV (≈1,500 informal worker profiles) in this folder and run:

    python backend/manage.py import-dataset data/dataset/<file>.csv

Required columns: Worker_ID, Name, Occupation, Skills, City
Optional columns: Experience_Years, Languages, Jobs_Completed, Completion_Rate, Average_Rating,
Peer_Endorsements, Dispute_Count, Verification_Status, Profile_Description, Customer_Review, Review_Sentiment

Completion_Rate may be 0–1 or 0–100. Average_Rating must be 1–5. See docs/ARCHITECTURE.md §3–4 for how
these columns become the trust components. Importing the same file twice is safe (existing Worker_IDs are skipped).
