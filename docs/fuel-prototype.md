# Fuel efficiency: research and analysis behind the prototype

**Status:** a prototype on the `prototype/fuel` branch, previewed at https://claude.ai/artifact/3qFrceiTDLRSq6mjoLUccF. It may be kept or dropped. GitHub Pages and the
claude.ai pages still show the simulator without it.

The prototype adds two readouts to every scene, for each road:

- **Fuel efficiency:** the fuel the cars would need to cover the same distance in steady flow at the
  road's load, as a share of the fuel they actually burned. 100% is the best that road allows.
- **Fuel per 100 km:** litres per 100 km, all cars together.

The branch has since gained a stress score per road (section 11), a fix to the emergency reflex
(section 9) and three pedal states for drivers who leave room (section 10).

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
mix. The figures below are from the engine with the three-pedal driver (section 10). Where that changed a
figure, the earlier value is in brackets.

**Midsize SUV:**

| Scene | Efficiency, mix | Efficiency, all tailgate | L/100 km, mix | L/100 km, all tailgate | Saving | Saving, compact car |
| --- | --- | --- | --- | --- | --- | --- |
| 1. One tap of the brakes | 47% | 47% | 15.3 | 15.3 | none (no drivers leave room) | none |
| 2. One driver leaves room | 96.5% | 53.6% | 7.3 | 13.2 | 44.9% | 46.5% |
| 3. Everyone leaves room | 101.3% (92.3%) | 47.0% | 7.1 (7.8) | 15.3 | 53.6% (49.1%) | 55.3% (50.7%) |
| 4. The ring-road experiment | 37.9% | 37.9% | 37.3 | 37.3 | none (no drivers leave room) | none |
| 5. Rush hour | 38.5% (38.8%) | 33.4% | 17.8 (17.7) | 21.2 | 15.7% (16.4%) | 16.4% (17.1%) |
| 6. Half and half | 79.8% (84.6%) | 34.2% | 8.6 (8.1) | 20.4 | 57.9% (60.3%) | 60.2% (62.4%) |

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
  lifts rush hour's mix from 38.5% to 47.6% and half-and-half from 79.8% to 83.1%. On the crowded ring it
  *lowers* the score, from 37.9% to 33.8%: without noise the wave forms later but deeper.
- **A score above 100% happens.** With everyone leaving room, the road scores 101.3%: after the tap
  the cars settle a little slower than the steady speed, nearer the thriftiest 50 km/h (section 1).
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

**The cars slider stops at what fits.** Its maximum is the road length divided by the room a stopped car
needs (car length plus stopped gap), up to the slider's 300. On the shortest road, 150 m with default cars,
that is 23. Shortening the road, or lengthening the cars or their stopped gap, removes cars that no longer
fit, by the same rules as a regime-map click.

**Crowded rings are drawn closer to scale.** Zoomed out, each car is a dot. The dots now shrink with the
average spacing between cars, down to a small minimum, so the gaps between cars stay visible. Before, a
fixed minimum dot size made 300 cars on a 6 km ring look bumper to bumper, though they had 15.5 m gaps.


## 9. The emergency reflex (bug fix)

**What was wrong.** Every car carries an emergency reflex. Each step it asks whether the car could stop
in time if the car ahead braked at 8 m/s², and brakes hard if stopping would take more than a set rate.
That rate was 3.5 m/s² for drivers who leave room and 5 m/s² for tailgaters. When many drivers leave
room, they share the road's space and end up with gaps close to the tailgaters'. At 67 km/h with a 25 m
gap, the 3.5 m/s² check fired with both cars at the same speed. The car braked at about 4.2 m/s² for a
moment, its normal control sped it up again, and the reflex fired again: 85 times in five minutes per car.

**Measured, hard decelerations (over 3 m/s²) per driver per km, before the fix:**

| Road | Drivers who leave room | Tailgaters |
| --- | --- | --- |
| Everyone leaves room, no tap | 6.9 | none on the road |
| Everyone leaves room, with tap | 16.9 | none on the road |
| Half and half | 11.2 | 0.4 |
| Rush hour | 24.1 | 4.8 |

**The fix.** One threshold, 5 m/s², for every driver. On a quiet road where everyone leaves room, hard
decelerations fell from 6.9 to 0 per km. Scene 2 did not change.

**An attempt that failed.** Firing the reflex only when the time to collision is under 3 s made things
worse. The reflex's early braking turned out to be part of how drivers who leave room absorbed a wave:
scene 2 lost its rescue, and two tests failed.

## 10. The three-pedal driver who leaves room

The owner pointed out that a driver has three states: on the gas, on neither pedal, or on the brake. With
the foot off both, the car slows by itself. Tailgaters keep the Intelligent Driver Model, whose one
continuous acceleration can be read the same way. Drivers who leave room now use the three states
explicitly.

**Why it was needed.** Even with the reflex fixed, drivers who leave room braked hard after a wave
arrived. Their rule holds the average speed of the traffic ahead and corrects only when the gap leaves a
band, whose floor is 0.8 s of travel. Car 21 of the "everyone leaves room" scene, for example, was still
on the gas while closing at 7 km/h on an 18 m gap, until the reflex fired. Bursts followed every 0.3 s.

**The rule now:**
1. **Gas:** with more than 1.5 s of gap, or the gap opening, hold the average speed as before and let the
   gap absorb a dip.
2. **Lift off:** closing in with under 1.5 s of gap, ease off the gas, slowing at the lift-off rate
   (`liftDecel`, 0.6 m/s²).
3. **Brake:** only if lifting off would not match the speed of the car ahead before the gap reaches the
   band's floor. The braking is as gentle as that allows, at most 3 m/s². The emergency reflex stays as
   a last resort.

**The lift-off rate.** About 0.6 m/s², an estimate. Rolling resistance and air drag give about 0.36 m/s²
for the midsize SUV at 90 km/h (section 3), and engine braking in gear adds roughly 0.3–0.7 m/s². The
engine-braking range is general knowledge, not yet checked against a source.

**Two designs that failed.** Both made drivers who leave room *pass on* dips instead of absorbing them:
- **Slowing whenever closing in,** just enough to match the car ahead before a 1 s gap. Each driver
  reacted to every small dip as if it would last.
- **The same rule, but waiting until it needed nearly a lift-off.** On scene 2's second lap of the wave,
  the driver matched the car ahead's lowest speed, 42 km/h, where the original rule rode it out at
  55 km/h.

**Before and after** (300 s per scene; the slowest car is counted after the first minute):

| Road | Average speed | Slowest car | Fuel efficiency | Hard decelerations per km |
| --- | --- | --- | --- | --- |
| 2. One driver leaves room | 65 → 65 km/h | 55 → 55 km/h | 96% → 96% | 0.04 → 0.04 |
| 3. Everyone leaves room | 40 → 55 km/h | 29 → 55 km/h | 92% → 101% | 15.2 → 0.01 |
| 5. Rush hour, with its drivers who leave room | 38 → 37 km/h | 0 → 0 | 39% → 39% | 5.9 → 4.4 |
| 6. Half and half | 34 → 29 km/h | 0 → 0 | 85% → 80% | 2.3 → 0.4 |

The "before" column already includes the reflex fix of section 9. Roads where everyone tailgates do not
change.

**What it costs.** Under heavy random wobble, the three-pedal drivers are slightly less effective. The
test "absorbers in the mix lower speed variation under noise" (4 drivers who leave room among 40, with
distraction 0.6) now fails, because speed variation falls to 0.79 of the all-tailgater level against
its limit of 0.75. Across five random seeds, the average ratio was:
- **before:** 0.89, from 0.72 to 1.16 depending on the seed;
- **after:** 0.93, from 0.79 to 1.08.

The test was already fragile, passing on one seed. It is left failing on this branch, pending a decision.

## 11. Stress per km

Each road gets a face in its lower-right corner, coloured by how stressful a kilometre of driving was.
The fuel pump moved to the lower-left corner.

**The measure:** stressful moments per vehicle-km, the sum of:
- **Firm brake events.** Braking harder than 2 m/s², about 0.2 g. One event lasts until the driver is
  back on the gas, after the brake-event definition of Stern et al. (2018). The 0.2 g threshold is the
  one a New Jersey highway study used to flag harsh braking; telematics vendors use 0.3–0.6 g. It is
  also the model's own comfortable braking rate.
- **Close calls.** Moments when the time to collision with the car ahead falls below 1.5 s, cleared
  above 3 s. The 1.5 s threshold is the conflict threshold of the US Federal Highway Administration's
  Surrogate Safety Assessment Model. Studies use 1.5 to 4 s.

Gentle braking and easing off the gas do not count. The brake lights now light only when the brake is
pressed, which means slowing faster than the lift-off rate.

**Research on stress itself.** Physiological studies tie driving stress to acceleration events: a
University of Houston and Texas A&M Transportation Institute team found about half their drivers
stressed by ordinary stop-and-go accelerations. No study found here gives stress per braking event, so
the score counts jolts. It does not measure stress directly.

**The face.** Its thresholds are anchored on Stern et al.'s braking counts from their real ring:
- smooth, wave damped: 0.12–0.21 per km;
- before waves formed: about 1.7 per km;
- with waves: 8.6–9.7 per km.

Hence:
- **happy:** below 0.5 per km;
- **neutral:** 0.5 to 2 per km;
- **frowning:** 2 per km or more.

The colour runs continuously on the speed ramp, on a log scale: green at 0.1 per km, amber near 1, red at
10 and above.

**Results** (SUV; `npm run analysis:fuel`):

| Scene | Your mix | Everyone tailgates |
| --- | --- | --- |
| 1. One tap of the brakes | 3.5 | 3.5 |
| 2. One driver leaves room | 0.06 | 2.0 |
| 3. Everyone leaves room | 0.04 | 3.5 |
| 4. The ring-road experiment | 83 | 83 |
| 5. Rush hour | 6.8 | 7.6 |
| 6. Half and half | 1.0 | 7.5 |

The ring-road figure is large because its cars average 8 km/h: every stop-and-go cycle is spread over
very little distance.

**Tests:**
- a quiet road has no stressful moments;
- a tapped knife-edge road scores above 1 per km, and below 0.5 with one driver who leaves room;
- drivers sharing a crowded road ease off instead of braking hard after a tap.

**Sources:**
- Stern et al. (2018), above, for the brake-event definition and the anchors.
- Federal Highway Administration, Surrogate Safety Assessment Model, for the 1.5 s threshold.
  Secondary source: <https://arxiv.org/abs/2010.10262>.
- Harsh-braking thresholds, 0.2 g on New Jersey highways:
  <https://researchwith.njit.edu/en/publications/evaluating-harsh-braking-events-as-a-surrogate-measure-of-crash-r/>.
  Vendor practice, 0.47–0.61 g: Geotab collision reconstruction white paper,
  <https://www.geotab.com/CMS-GeneralFiles-production/NA/White_papers/geotab-collision-reconstruction-whitepaper-2020(web).pdf%20%5BPUBLIC%5D-V2.pdf>.
- University of Houston, *Researchers find hidden micro-stressors in routine driving* (2023),
  <https://www.uh.edu/nsm/news-events/stories/2023/0705-routine-driving.php>.
