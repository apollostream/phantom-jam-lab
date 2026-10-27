# Fuel efficiency: research and analysis behind the prototype

**Status:** a prototype on the `prototype/fuel` branch, previewed at https://claude.ai/artifact/3qFrceiTDLRSq6mjoLUccF. It may be kept or dropped. GitHub Pages and the
claude.ai pages still show the simulator without it.

The prototype adds two readouts to every scene, for each road:

- **Fuel efficiency:** the fuel the cars would need to cover the same distance in steady flow at the
  road's load, as a share of the fuel they actually burned. 100% is the best that road allows.
- **Fuel per 100 km:** litres per 100 km, all cars together.

A switch under Vehicles chooses the car the fuel model describes: a **midsize SUV** (the default) or a
**compact car**.

## 1. The question

The owner proposed scoring each scenario by the fuel actually burned per loop against the fuel burned if
every car held the posted speed limit. Two refinements followed in discussion.

1. **Count fuel per distance, not per unit of time.** A jammed road completes fewer loops, so cars that
   barely move burn little fuel per minute, and a jam would look thrifty over a fixed time. Per kilometre
   driven, the cost of stop-and-go shows up properly. Per loop and per kilometre are the same measure,
   because the lap length is fixed.
2. **Use steady flow at the road's load as the ideal, and score from 0 to 100%.** On a crowded ring the
   cars cannot all hold the limit, so a speed-limit baseline mixes two costs: crowding and waves. The
   owner chose the second baseline, which isolates the cost of the waves, and asked for 100% to mean that
   ideal.

So:

> **Fuel efficiency = 100% × (fuel per km in steady flow at this load) ÷ (fuel per km actually burned)**

**Steady flow at this load** means every car at the one common speed at which each keeps its preferred
gap: the speed the engine already uses to place cars at the start (`Sim.equilibriumSpeed`). It depends
on the mix, because drivers who leave room keep wider gaps.

The score can pass 100% in a rare case. Fuel per kilometre is lowest near 50 km/h. On a fast, lightly
loaded road, wavy traffic that averages slower than the steady speed could burn less than steady flow
would. The readout shows the true value rather than capping it.

## 2. Choosing a fuel model

A fuel model for a traffic simulator needs only each car's speed and acceleration at each moment. The
candidates:

| Model | What it is | Verdict |
| --- | --- | --- |
| **Power-based model** (Akçelik and colleagues, Australian Road Research Board, 1983 onward; still in the SIDRA software) | fuel follows the power the engine delivers: rolling resistance, air drag and acceleration, plus an idle rate | **chosen**: physically grounded, few parameters, all published, and easy to explain |
| VT-Micro (Rakha, Ahn and colleagues, Virginia Tech, early 2000s) | a regression of the logarithm of fuel rate on speed and acceleration | set aside: a fitted surface with no physics, and its coefficients are tied to particular test cars |
| VT-CPFM (Rakha et al., Virginia Tech, 2011) | power-based, calibrated from a car's published fuel-economy ratings | set aside for the prototype: close in spirit to the chosen model, but its parameters for a generic car are harder to pin down |
| Vehicle-specific power with the MOVES operating modes (Jiménez-Palacios 1999; US Environmental Protection Agency) | binned power demand, built mainly for emissions | set aside: finer-grained than this project needs |

### The chosen model

In the form given by Akçelik, Smit and Besley (2012), the fuel rate *f* (mL/s) is:

- while the engine pushes (total tractive power *P*<sub>T</sub> > 0):
  *f* = α + β₁ *P*<sub>T</sub> + β₂ *a* *P*<sub>I</sub>, where the last term counts only while speeding up (*a* > 0);
- otherwise (*P*<sub>T</sub> ≤ 0, braking or coasting downhill): *f* = α.

The symbols:

- α is the idle fuel rate.
- *P*<sub>T</sub> = (*F*<sub>roll</sub> + *k v*² + *M a*) *v* / 1000 is the tractive power in kW on level
  road, capped at the engine's maximum power. It is made of rolling resistance *F*<sub>roll</sub>, air drag
  *k v*², and the inertial force *M a*.
- *P*<sub>I</sub> = *M a v* / 1000 is the part of that power spent on acceleration.
- β₁ is fuel per kJ of work at the wheels.
- β₂ adds the extra fuel of hard acceleration, when the engine runs less efficiently.

SIDRA states the resistances as fuel costs per kilometre:
- *A* (mL/km) for rolling resistance;
- *B* (mL/km per (km/h)²) for drag.

They convert to forces as *F*<sub>roll</sub> = *A*/β₁ newtons and *k* = 3.6² *B*/β₁ newtons per (m/s)².
At steady speed the model reduces to:

> fuel per km = α/*v* + *A* + *B v*²  (α in mL/h, *v* in km/h)

That is an idle cost spread over the distance, a rolling cost, and a drag cost.

### How the model treats braking

While braking, *P*<sub>T</sub> is negative and the car burns only idle fuel. The model gives no credit
for the kinetic energy thrown away as heat in the brakes. That energy was bought with fuel during the
previous acceleration, through the *M a v* term. So a brake-and-recover cycle costs the fuel of
re-accelerating. A car that eases off instead lets drag and rolling resistance slow it, spending its
kinetic energy against forces it would have had to overcome anyway.

**Scale of the effect:** one start from rest to 50 km/h at the tailgaters' 1.2 m/s² costs, beyond
cruising the same distance:

| Vehicle | Extra fuel for one start | Equivalent cruising at 50 km/h |
| --- | --- | --- |
| Compact car | 16.6 mL | 0.43 km |
| Midsize SUV | 27.1 mL | 0.40 km |

Every full stop-and-go cycle therefore costs roughly as much as 400 m of steady driving.

## 3. Parameters

| Parameter | Compact car | Midsize SUV | Units |
| --- | --- | --- | --- |
| Mass *M* | 1,250 | 2,000 | kg |
| Maximum power | 100 | 200 | kW |
| Idle rate α | 889 | 1,700 | mL/h |
| Rolling cost *A* | 12.2 | 19.5 | mL/km |
| Drag cost *B* | 0.0036 | 0.0059 | mL/km per (km/h)² |
| Efficiency β₁ | 0.0926 | 0.0926 | mL/kJ |
| Hard-acceleration term β₂ | 0.030 | 0.030 | mL/(kJ·m/s²) |

### Compact car

The compact car is the **2004 Toyota Corolla** (1.8 L petrol, automatic) that Akçelik, Smit and Besley
(2012) calibrated in an emissions laboratory on a real-world urban drive cycle.
- **Measured values:** mass, maximum power, α, *A*, *B* and β₁.
- **β₂:** the paper did not calibrate it for the Corolla, so the prototype uses the paper's default
  passenger-car value of 0.030.

For comparison, that default car (SIDRA TRIP) has:

| α | *A* | *B* | β₁ | β₂ |
| --- | --- | --- | --- | --- |
| 1,300 mL/h | 20.0 mL/km | 0.0050 | 0.090 | 0.030 |

### Midsize SUV

The owner asked for a vehicle closer to the typical American one, which is likely a heavier, less
aerodynamic SUV with a larger engine. No published calibration of this model for a midsize SUV turned
up, so the SUV is the measured Corolla scaled by physics:

- **Mass, 2,000 kg (×1.6).** About the average new US light-duty vehicle for model year 2024, which a
  secondary source (Wolf Street, citing the EPA Automotive Trends Report) gives as 4,419 lb. Not yet
  confirmed in the EPA report itself.
- **Rolling cost *A*, 19.5 mL/km.** Rolling resistance is proportional to weight: 12.2 × 1.6.
- **Drag cost *B*, 0.0059.** Drag scales with drag coefficient times frontal area:
  - compact car: about 0.29 × 2.1 m² ≈ 0.61 m²;
  - midsize SUV: about 0.36 × 2.8 m² ≈ 1.0 m².

  The ratio is about 1.65, giving 0.0036 × 1.65. Both areas are typical values, assumed rather than
  measured.
- **Idle rate α, 1,700 mL/h.** Idle fuel rises roughly with engine displacement: 889 × 3.5 L / 1.8 L.
- **Maximum power, 200 kW.** The model-year 2024 average of 267 hp, from the same secondary source.
- **β₁ and β₂:** unchanged, on the assumption that a modern SUV engine converts fuel to work about as
  efficiently as a compact's.

### Checks against published fuel economy

| Vehicle | Model at 100 km/h | Published comparison |
| --- | --- | --- |
| Midsize SUV | 9.55 L/100 km (24.6 mpg) | the EPA's model-year 2024 average for truck SUVs: 25.7 mpg real-world, combined city and highway |
| Compact car | 5.71 L/100 km (41 mpg) | in the range of the Corolla's highway ratings |

Steady-cruise fuel, L/100 km:

| Vehicle | 30 km/h | 50 km/h | 60 km/h | 100 km/h | Thriftiest speed |
| --- | --- | --- | --- | --- | --- |
| Compact car | 4.51 | 3.90 | 4.00 | 5.71 | 50 km/h |
| Midsize SUV | 8.15 | 6.83 | 6.91 | 9.55 | 52 km/h |

## 4. How the engine computes it

All of it lives in `src/engine.js`:
- **The model:** `VEHICLES`, `fuelRate(vehicle, v, a)` and `cruiseFuelPerM(vehicle, v)`.
- **Each time step:** every car adds the fuel burned over the step, at the step's mean speed and its
  acceleration. The ideal adds, for the same distance, the fuel of cruising at the steady speed.
- **The two readouts** (`snapshot()`): fuel efficiency is ideal fuel over actual fuel, and fuel per
  100 km is total fuel over total distance. Both count from the start of the run, and restart when the
  vehicle is switched.
- **Real units only:** fuel is counted only in real units. The scale-model mode of the similarity test
  (`unitL`, `unitT`) has no physical car, so it reports no fuel.
- **Steady speed:** computed by `equilibriumSpeed()`, the same calculation that places the cars at the
  start. It ignores each driver's small personal variations, so a quiet road reads 100.1–100.2%.

**Tests** (`test/engine.test.mjs`):
- steady-cruise fuel matches the hand calculation;
- braking burns only the idle rate;
- a quiet road scores within 1% of 100% for both vehicles;
- one brake tap that becomes a jam scores below 70%;
- a rescaled model reports no fuel.

## 5. Results

`node analysis/fuel.mjs` plays each scene as the app does for 300 simulated seconds, with the scene's
mix and with everyone tailgating, and writes `analysis/results/fuel.json`. Each road is scored against
its own steady flow. **Saving** is the drop in litres per 100 km from everyone tailgating to the scene's
mix.

**Midsize SUV:**

| Scene | Efficiency, mix | Efficiency, all tailgate | L/100 km, mix | L/100 km, all tailgate | Saving | Saving, compact car |
| --- | --- | --- | --- | --- | --- | --- |
| 1. One tap of the brakes | 47% | 47% | 15.3 | 15.3 | none (no drivers leave room) | none |
| 2. One driver leaves room | 96.5% | 53.6% | 7.3 | 13.2 | 44.9% | 46.5% |
| 3. Everyone leaves room | 92.3% | 47.0% | 7.8 | 15.3 | 49.1% | 50.7% |
| 4. The ring-road experiment | 37.9% | 37.9% | 37.3 | 37.3 | none (no drivers leave room) | none |
| 5. Rush hour | 38.8% | 33.4% | 17.7 | 21.2 | 16.4% | 17.1% |
| 6. Half and half | 84.6% | 34.2% | 8.1 | 20.4 | 60.3% | 62.4% |

**What the results show:**

- **Waves cost about half the fuel.** A road where one tap grows into a jam runs at about 47% efficiency,
  burning roughly twice the fuel its load requires. In scene 2, one driver who leaves room brings that
  road back to 96.5%.
- **The saving matches the field test.** Stern et al. (2018) measured the fuel of every car on a real
  ring through its on-board diagnostics port. Their best result was 42.5% less fuel when one
  automated car damped the wave (Experiment A, set speed 7.5 m/s). Their other experiments gave 27.9% and
  17.9%. Scene 2's 45% is close to their best. This is a check on the model, which was not tuned to
  match. The setups differ: their ring ran near 27 km/h, while scene 2 runs near 65 km/h.
- **Absolute fuel on the crowded ring is not comparable to the field test.** Stern et al. recorded
  14–22 L/100 km. Scene 4 gives 37 L/100 km because its cars average 8 km/h, where idling dominates. The
  simulated ring is more crowded than theirs.
- **The vehicle barely changes the score.** The SUV burns 65–75% more fuel than the compact car, but
  efficiency and saving differ by only one or two points. Both are ratios, and in this model the cost of
  stop-and-go scales with the car's overall thirst.
- **Speed wobble costs efficiency only where wobble is switched on** (scenes 4 to 6). Turning it off
  lifts rush hour's mix from 38.8% to 47.5% and half-and-half from 84.6% to 88.3%. On the crowded ring it
  *lowers* the score, from 37.9% to 33.8%: without noise the wave forms later but deeper.
- **The hard-acceleration term matters, but less than the basic energy cost.** Setting β₂ to zero
  lifts the jammed roads by about 5 points (47% to 52% on the tapped road). Most of the waste is the
  plain cost of buying back kinetic energy.

## 6. Limits and open questions

- **Not modelled:**
  - slipstreaming (drafting) behind the car ahead;
  - road gradient;
  - cold starts;
  - engines that switch off when stopped (start-stop), which would cut the idle cost of a jam;
  - hybrid regenerative braking, which would recover part of the braking loss.
- **The SUV is an estimate,** scaled from a measured compact car. A direct calibration would need an
  SUV's laboratory data, or VT-CPFM's method of fitting to a vehicle's city and highway ratings.
- **The 2024 fleet figures are second-hand:** the average vehicle mass and horsepower come from a
  secondary report of the EPA's figures, not yet checked in the EPA report itself.
- **Every car is the same vehicle.** A mixed fleet would need per-car vehicle types.
- **The score counts the whole run.** A rolling window, such as the last minute, would respond faster
  when settings change mid-run.

## 7. If the prototype is kept

- **Analysis:** add `analysis/fuel.mjs` to `npm run analysis`, and fuel efficiency to the regime sweep,
  so the regime map can show fuel cost across load and reaction ratio.
- **Report:** add a section to *The Jam Nobody Started*, with each number registered in
  `report/facts.mjs` and each source in `report/sources.json`.
- **Publishing:** republish the claude.ai simulator. GitHub Pages updates when the branch is merged into
  `main`.

## 8. Sources

- Akçelik, R., Smit, R., & Besley, M. (2012). *Calibrating fuel consumption and emission models for
  modern vehicles.* IPENZ Transportation Group Conference, Rotorua.
  <https://www.transportationgroup.nz/papers/2012/Wednesday/0930%20Akcelik,%20Rahmi.pdf>
  The model's equations, the Corolla calibration and the default car's parameters.
- Akçelik, R. (1989). Efficiency and drag in the power-based model of fuel consumption. *Transportation
  Research Part B: Methodological, 23*(5), 376–385. <https://doi.org/10.1016/0191-2615(89)90014-3>
  (checked against Crossref).
- Akçelik, R., Bayley, C., Bowyer, D. P., & Biggs, D. C. (1983). A hierarchy of vehicle fuel
  consumption models. *Traffic Engineering and Control, 24*(10), 491–495.
  <https://www.sidrasolutions.com/learn/publications/hierarchy-vehicle-fuel-consumption-models>
- Stern, R. E., Cui, S., Delle Monache, M. L., et al. (2018). Dissipation of stop-and-go waves via
  control of autonomous vehicles: Field experiments. *Transportation Research Part C: Emerging
  Technologies, 89*, 205–221. <https://doi.org/10.1016/j.trc.2018.02.005> (checked against Crossref;
  full text at <https://arxiv.org/abs/1705.01693>).
- US Environmental Protection Agency. *The 2024 EPA Automotive Trends Report.*
  <https://www.epa.gov/automotive-trends/highlights-automotive-trends-report> (truck SUV fuel economy,
  25.7 mpg for model year 2024).
- Wolf Street (2024, November 25). *Americans buy ever bigger, more powerful, more fuel-efficient
  trucks, SUVs and cars.* <https://wolfstreet.com/2024/11/25/americans-buy-ever-bigger-more-powerful-but-more-fuel-efficient-trucks-suvs-and-cars-evs-escalate-the-horsepower-war/>
  (average mass and power, citing the EPA report; to be confirmed).
- Rakha, H. A., et al. Virginia Tech Comprehensive Power-Based Fuel Consumption Model (VT-CPFM).
  <https://www.academia.edu/85794601/Virginia_Tech_Comprehensive_Power_Based_Fuel_Consumption_Model_Model_development_and_testing>
  (considered, not used).

## 9. Reproduce

```sh
git switch prototype/fuel
npm test                      # includes the five fuel tests
npm run analysis:fuel         # the results above, into analysis/results/fuel.json
npm run build                 # the simulator with the fuel readouts, in dist/
```

## Other changes on this branch

**Regime map clicks hold the road length.** On `main`, clicking the regime map sets the delay R through
the reaction time and the load Λ through the lap length. On this branch the lap length stays fixed, and
the load is set by the number of cars instead: N = Λ × L ÷ (ℓ + s₀ + v₀T), rounded, between 2 and 300.

- **Drivers who leave room:** their count is capped at the new N. Hand-picked drivers, such as scene 2's
  car 30, are kept only while their car is still on the road.
- **Everything else is held:** speed limit, following times, vehicle settings, distraction and taps.
- **Resolution:** Λ moves in steps of one car, (ℓ + s₀ + v₀T) ÷ L. On scene 2's 860 m ring that is about 0.04.
