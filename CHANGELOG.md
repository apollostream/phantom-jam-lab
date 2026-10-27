# Changelog

## 2.0.0 (unreleased)

Adds to the simulator without changing its original behaviour: driver model A, the default, reproduces
version 1.0.0's results exactly. [`docs/fuel-stress-and-variant-b.md`](docs/fuel-stress-and-variant-b.md)
explains each change.

- **Fuel efficiency** for each road, with a fuel-pump gauge: steady-flow fuel at the road's load as a
  share of fuel burned, from Akçelik's power-based fuel model. A switch picks a midsize SUV or a compact
  car.
- **Stress** for each road, with a face: the average distance driven between firm braking or close calls.
- **Driver model B, three-state,** for drivers who leave room: they coast before they brake, and their
  emergency brake fires at the same threshold as a tailgater's. Model A, the original, stays the default.
- **A-against-B comparison:** the second road can run the same drivers under the other model.
- **Regime-map clicks** now hold the road length and set the load with the number of cars.
- **The cars slider** stops at the number of cars that fit on the road.
- **Crowded rings** are drawn closer to scale.

## 1.0.0

The simulator, the Szirtes dimensional analysis, and the report *The Jam Nobody Started*.
