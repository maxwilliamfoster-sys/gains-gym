# Gains Gym

An arcade-idle gym tycoon for the web (Monkey Mart / Voodoo style), built for Poki.

**Play:** https://maxwilliamfoster-sys.github.io/gains-gym/

Build your gym up from a garage:
- Drag anywhere to walk (on a computer, use WASD or the arrow keys).
- Stand at the **towel shelf** to stack towels on your back, then walk to a machine to drop them. Members need a towel to work out.
- Stand at the **front desk** to check members in.
- Walk over the **cash** that finished workouts leave behind to collect it.
- Stand on a **price pad** to spend cash on new machines, the shake bar, staff, and finally a bigger gym.
- Use **Upgrades** to get faster, carry more, raise prices, speed up workouts and train your staff.

## The gyms
Each gym has its own room, machines and build order. After the third, the cycle repeats with ×216 payouts.

| Gym | Room | Machines | New twist |
|---|---|---|---|
| Garage Gains | small | bench, treadmill, squat rack, dumbbells, boxing bag | — |
| Iron Temple | wide hall | cable machine, rowing machine, spin bike, leg press, pull-up tower, battle ropes | cardio needs **water bottles** from the cooler; hire water staff |
| Muscle Palace | big, 9 stations | Smith machine, pec deck, stair climber, climbing wall, boxing ring, sauna | the biggest earners (ring and sauna) |

## Layout
- `docs/`: the game itself, with no build step. GitHub Pages serves this folder.
- `tools/pacing.js`: a bot that plays a fresh save and logs when each unlock lands, used to tune prices.

The real Poki SDK only loads on Poki or with `?poki` in the URL. Everywhere else a no-ad shim is used.
