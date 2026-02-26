Let me walk through exactly what happens with all 150 crimes, step by step.

---

## Imagine You Have 150 Crimes in the Database

Your route goes from **Dhanmondi → Gulshan**. The system now checks every single one of those 150 crimes, one by one.

---

## The Loop — It Checks Every Crime, One at a Time

```
Crime 1   → check distance → too far (600m) → SKIP
Crime 2   → check distance → close (200m)   → CALCULATE RISK
Crime 3   → check distance → too far (800m) → SKIP
Crime 4   → check distance → close (50m)    → CALCULATE RISK
...
Crime 150 → check distance → too far (1km)  → SKIP
```

Out of 150 crimes, maybe only **12 are within 500m**. The other 138 are completely ignored.

---

## How Does It Find "How Close" a Crime Is?

Your route is not a straight line — it's a **chain of small segments** like this:

```
P1 ——— P2 ——— P3 ——— P4 ——— P5 ——— P6   (your route, made of 5 segments)
```

For **each crime**, the system checks the distance to **every single segment**:

```
Crime at point X:
  → Distance to segment P1→P2 = 400m
  → Distance to segment P2→P3 = 180m   ← smallest!
  → Distance to segment P3→P4 = 350m
  → Distance to segment P4→P5 = 290m
  → Distance to segment P5→P6 = 410m

Nearest distance = 180m  ✅ (within 500m, so this crime COUNTS)
```

It picks the **minimum** of all those distances. That's `minDistanceToRoute()`.

---

## How Does It Measure Distance to ONE Segment?

Say the crime is point **X**, and the segment goes from **P2 to P3**.

```
P2 ————————————————— P3
            |
            | ← perpendicular drop
            |
            X  (crime location)
```

It drops a **perpendicular line** from the crime to the road segment and measures that. This is `distanceToLineSegment()`.

But what if the crime is not "beside" the segment, but "past the end"?

```
CASE 1: Crime is beside the segment → measure perpendicular distance
P2 ————————————— P3
        |
        X

CASE 2: Crime is past the end → measure distance to nearest endpoint
P2 ————————————— P3
                      X
                (distance to P3 is used)

CASE 3: Crime is before the start → measure distance to P2
X
  P2 ————————————— P3
(distance to P2 is used)
```

The `param` variable in the code decides which case applies:
- `param` between 0 and 1 → Case 1 (on the side)
- `param < 0` → Case 3 (before the segment)
- `param > 1` → Case 2 (past the segment)

The Haversine formula then gives the actual km distance for whichever point was chosen.

---

## What Happens to the 12 Crimes That ARE Within 500m?

For each of those 12 crimes, it calculates a risk number. Here's a concrete example with real numbers:

**Crime 7 — Robbery, 200m from route, happened at Night, severity 8**  
You set: travelling at **Night**, **Cautious**, **Violence concern = High**

```
Distance Factor  = 1 - (0.200 / 0.500) = 0.60
Severity Factor  = 8 / 10              = 0.80
Time Factor      = 2.0  (you travel at Night, crime happened at Night → MATCH)
Crime Type Weight= 1.7  (Robbery)
Your Concern     = 1.8  (you set Violence = High)
Your Tolerance   = 1.5  (Cautious)
× 10

Risk = 0.60 × 0.80 × 2.0 × 1.7 × 1.8 × 1.5 × 10 = 44.09
```

**Crime 23 — Vandalism, 50m from route, happened during Day, severity 3**  
Same settings (travelling at Night)

```
Distance Factor  = 1 - (0.050 / 0.500) = 0.90
Severity Factor  = 3 / 10              = 0.30
Time Factor      = 0.5  (you travel at Night, crime happened at Day → NO MATCH)
Crime Type Weight= 0.7  (Vandalism)
Your Concern     = 0.6  (you set Minor crimes = Low)
Your Tolerance   = 1.5  (Cautious)
× 10

Risk = 0.90 × 0.30 × 0.5 × 0.7 × 0.6 × 1.5 × 10 = 0.85
```

> Notice: The vandalism is **physically closer** (50m) than the robbery (200m), but its risk number is **0.85 vs 44.09** — because it's a minor crime, happened during the wrong time, and you don't care much about it. **Distance alone doesn't decide everything.**

---

## After All 12 Crimes Are Processed

```
Crime 4  → risk = 44.09
Crime 7  → risk = 38.20
Crime 12 → risk = 0.85
Crime 19 → risk = 12.40
Crime 23 → risk = 5.10
... (12 crimes total)

Total Risk Score = 44.09 + 38.20 + 0.85 + 12.40 + 5.10 + ... = 156.80
Number of crimes near route = 12
```

---

## Converting That Into a Safety Score

**Quality (how bad on average):**
```
Average risk per crime = 156.80 / 12 = 13.07
avgRiskNorm = 13.07 / 40 = 0.327  (on a 0–1 scale)
```

**Quantity (how many):**
```
densityNorm = ln(1 + 12) / 4 = ln(13) / 4 = 2.565 / 4 = 0.641
```

**Blend (70% quality + 30% quantity):**
```
combinedRisk = 0.70 × 0.327 + 0.30 × 0.641 = 0.229 + 0.192 = 0.421
```

**Final score:**
```
Penalty      = 0.421 × 85 = 35.8
Safety Score = 100 - 35.8 = 64.2  (out of 100)
             = 64.2 / 10  = 6.4   (out of 10)
Risk Level   = Medium  (between 5.0 and 7.5)
```

---

## The Full Picture in One Diagram

```
150 crimes in database
        │
        ▼
┌─────────────────────────────────────┐
│  For each crime (loop 150 times):   │
│                                     │
│  Check distance to EVERY segment    │
│  of the route → keep the MINIMUM   │
│                                     │
│  If minimum distance > 500m → SKIP  │
│  If minimum distance ≤ 500m → COUNT │
└─────────────────────────────────────┘
        │
        │  138 crimes SKIPPED
        │  12 crimes COUNTED
        ▼
┌─────────────────────────────────────┐
│  For each of 12 counted crimes:     │
│                                     │
│  risk = distance × severity ×       │
│         time × type ×               │
│         yourConcern × yourTolerance │
│         × 10                        │
│                                     │
│  Add to totalRiskScore              │
└─────────────────────────────────────┘
        │
        ▼
totalRiskScore = 156.80
        │
        ▼
Quality = avg risk / 40       = 0.327
Quantity = log(13) / 4        = 0.641
Combined = 70%×Q + 30%×D     = 0.421
Penalty  = 0.421 × 85        = 35.8
Score    = (100 - 35.8) / 10 = 6.4
Label    = Medium Risk 🟡
```

---

**One sentence summary:** The system loops through all 150 crimes, throws away the 138 that are too far away, calculates a danger number for each of the remaining 12 using your personal travel settings, adds them all up, and converts that total into a score from 0–10.


Algorithm / Technique	Where in Your Code	Famous Field
Haversine Formula	calculateDistance()	Navigation / GIS
Point-to-Segment Projection	distanceToLineSegment()	Computational Geometry
Spatial Buffer Analysis	500m threshold filter	GIS
Weighted Product Model (WPM)	Risk = A × B × C × D...	MCDA / Decision Theory
Log Normalization	log(1 + crimes) / 4	Information Retrieval
Weighted Sum Model	70% quality + 30% quantity	MCDA / Credit Scoring
Penalty-Based Scoring	Start 100, subtract risk	Credit Scoring
Kernel Density Estimation	Crime hotspot detection	Criminology / Statistics
DBSCAN (simplified)	3+ crimes = hotspot flag	Machine Learning
Context-Aware Ranking	Day/Night + preferences	Recommender Systems