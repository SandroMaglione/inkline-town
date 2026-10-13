# How to play

[← back to the README](../README.md)

Everything a mayor needs to know: how a term runs, what puts pressure on the
town, the levers you hold, how a term ends, and how the town works underneath.

## Controls

| | |
|---|---|
| drag, arrow keys | pan the map (road/home tools drag to build) |
| right-drag, or drag with **Rotate** selected | rotate and tilt the 3D map |
| **Q**, **E** | rotate left/right |
| mouse wheel, **+** / **−** | zoom |
| two fingers | pan, pinch to zoom, twist to rotate |
| **Home**, camera reset button | restore the original view |
| **S** | select: click a building or a home to see what it does |
| **R** | road: drag to lay one |
| **P** | pave: drag along a road to pave it (coins and a stone a cell) |
| **H** | homes: drag to lay a row along a road |
| **B** | build: pick a building, then click the map |
| **X** | bulldoze |
| **T** | the town panel: goals, approval, treasury, taxes, people, the crown, trade |
| **D**, **W**, **F**, **A**, **O**, **C** | map views: desirability, workers, fire, health (aid), order, condition; the same key again hides it |
| **space** | pause |
| **1**, **2**, **3** | run at 1×, 2×, 4× |
| **Esc** | stop placing, close the panel |

Save, load, and new town sit in the bottom right. The town also autosaves
every two minutes of game time, and **load** takes whichever save is newer.
New town and load ask before they replace the town you have.

## A term in office

- **The charter**: a new town is founded on land you choose: its size
  (small, medium, large), its richness (rich, fair, harsh: forests, stone,
  ore, lakes, and the starting treasury), and the length of the term (45,
  60, or 90 minutes at 1×). The land is an island-like stretch with a
  wandering coast and capes reaching out; the same seed always makes the
  same land.
- **Pressure** builds as the town grows:
  - *winters*: a term is six years, and every year but the first ends in a
    winter when fields do not grow, fisheries catch half as much, and homes
    eat faster;
  - *administration*: the town hall costs more per home the more homes
    there are, so a big town of poor homes cannot pay its way;
  - *the crown* asks for goods the town makes, more as the term goes on;
    sending them pays, and an unanswered request is a fine and a snub the
    town remembers;
  - *the market*: prices fall the more the town sells and rise the more
    it buys; stone and ore run out;
  - *approval*, from -100 to 100, follows needs met, taxes, unpaid wages,
    snubs from the crown, and hungry winters, and decides how many people
    each home holds.
- **The levers**: taxes per tier; for each good, sell beyond the reserve,
  buy up to it (at half again the price), or neither; the reserve itself;
  pausing a building (no workers, a quarter of its upkeep); answering the
  crown; and the speed of time (space pauses, 1, 2, 3 for 1×, 2×, 4×).
- **The end**: the town is *complete* once it holds every goal for two
  minutes (enough residents and coins for its size, three in ten of them
  citizens, approval 15 or more, not losing coins); you may retire or keep
  governing. It is *lost* to bankruptcy (three minutes in debt), revolt
  (approval at -50 or below for two minutes), abandonment (people fall
  below 15% of their peak), or dismissal (three of the crown's requests
  missed in a row). Otherwise the term runs out, and the town
  is judged flourishing, holding on, or declining. The reckoning shows the
  term's history and its chronicle.

## The neighbourhood

The town is meant to look and work like a real one: a fine centre, an
industrial edge, and workers' cottages clustered by the mill or the mine.
Nobody tells you to build it that way; it works best that way.

- **Desirability.** Every cell has one. Buildings and the land add to it or
  take from it, fading with distance: a smithy, quarry, or mine takes 8
  beside it and less out to four cells; a sawmill, bakery, mill, or
  smokehouse 4; warehouses, farms, a granary, a builder's yard 2. Water and
  woods give 2, a garden 3, a park or fountain 6, a statue or plaza 10, a
  market 2 and a chapel 4, the town hall 4, and a paved street 1 beside it.
  Ruins and run-down homes take a little. Ornaments cost upkeep: a fine
  centre is something you choose to pay for.
- **Tiers.** Settlers live anywhere. A citizens' home needs desirability 5
  as well as bread, cloth, and faith; a home whose street drops below 5
  goes back to settlers even with every need met. A **townhouse** of
  burghers (12 residents, the best taxes) needs desirability 15 and a
  fire watch, a healer, and a watch house all calling on it. At
  desirability −5 or less a home is squalid and holds fewer people.
- **Workers by tier, and the commute.** Settlers do the rough work
  (lumberjack, forester, quarry, mine, fishery, smokehouse, farm, sheep,
  storage, fire watch, watch house, builder's yard); citizens the skilled
  (sawmill, smithy, mill, bakery, weaver, market, chapel, healer,
  hospital). Citizens never take settlers' jobs: upgrade every home and the
  quarry stands empty. Until there are citizens, settlers stand in at a
  skilled job as apprentices, at three-quarters pace. A home only supplies workers to
  workplaces within 15 road cells, so a distant mine needs its own workers'
  cottages beside it (they stay settlers in its dust, which is what it
  needs). A workplace short of workers says whether anyone lives within
  reach.

## Services, and what goes wrong without them

Every home has three risk meters that rise slowly, at a pace fixed by where
it stands, and every building a fire meter. A walker from the matching
service resets one as it passes. Past 70% a sign goes up over the home (a
smoke wisp, a pale face, a broken window); disaster comes only if the meter
reaches the top.

| Service | Building | What raises the risk | If neglected |
|---|---|---|---|
| fire | **fire watch**: a watchman, and firefighters who run to any blaze | wooden settlers' cottages, a bakery, smithy, or smokehouse within two cells, crowding, a run-down building, heating in a hard winter | the home catches fire; it burns for 20 seconds and may set its neighbours alight. When firefighters arrive, that house is lost but the fire goes no further. A ruin is left to clear |
| health | **healer**, later a **hospital** | hunger, crowding, desirability below 0, a quarry's or mine's dust, still water | sickness: the home holds half as many until it passes or a physician calls, and it raises the risk of homes around it |
| order | **watch house**: a constable | approval below 0, desirability below 0, a half-empty home, a burghers' townhouse | a theft (coins, or goods when the treasury is empty), then the home is left derelict |

A good layout prevents disasters: streets between rows of homes stop a fire
from spreading, a fire watch near the cottages gets firefighters there in
time, and industry away from homes keeps them healthy and orderly. The town
ticker under the top bar lists what needs attention now (fires, sickness,
workshops waiting for inputs, workplaces nobody can walk to, no food in
store) and the latest news, which also pops up as it happens.

## Wear, spoilage, and winters

- **Food spoils in store**: fish keeps about three minutes, bread about
  five; wheat, flour, and smoked fish keep. A **granary** keeps fish and
  bread five times as long, and a **smokehouse** turns fish into smoked
  fish, which keeps through any winter. Markets hand out fresh fish first.
- **Tools wear out**: a lumberjack, quarry, mine, sawmill, mill, bakery,
  weaver, or smokehouse uses up a tool every 50 or 60 jobs, and works at
  half pace without one. Carriers keep one on hand at each.
- **Buildings and homes run down**, in about half an hour to half and an
  hour and more to nothing. A **builder's yard** sends a builder to mend whatever is run
  down along the way, a plank for a home and a plank and a stone for a
  building. Below half, a workshop works at half pace and its fire risk
  rises, and a home looks worn and drags its street down; at nothing it
  falls into a ruin.
- **Winters vary**: each year's is mild (fishing at 75%), normal (50%), or
  hard (half as long again, fishing at 25%, and heating raises every home's
  fire risk), rolled from the seed. The almanac in the clock shows the
  coming winter a year ahead (hover it for the one after), a minute before
  each winter the news says how much food is in store and how much the
  town eats a minute, and through winter the map lies frosted.

## How the town works

- **A new town** has a town hall in a clearing, ringed by road, plus
  starting coins and goods.
- **Coins**: homes the town hall can reach by road pay taxes; traders buy
  what the town sells and sell it what it buys; every building costs upkeep
  and the town hall costs administration. Building costs coins up front.
  The **town** panel (T, the town button, or the people in the top right) shows the goals, approval,
  treasury, people, supplies, the crown, goods and trade, and the
  chronicle, and holds the levers.
- **Materials** (planks, stone, tools) come from storage: a new building is a
  site until carriers have brought what it costs, then it goes up.
- **Homes** fill with settlers once a road touches them. Settlers need food
  (fish, smoked fish, or bread); with bread, cloth, and faith on a street
  with desirability 5 a home becomes a two-story citizens' home that holds
  and pays twice as much, and on a fine street (15) with every service
  calling, a three-story townhouse.
- **Buildings** need a road at the middle of a side and workers of their
  crew from homes within 15 road cells. Ornaments need no road and no
  workers; their stone comes straight out of storage. Gatherers work the land within their reach (trees, rocks, water,
  fields); workshops turn one good into another.
- **Carriers** walk every good along the roads: producers send to whoever
  wants it (a site, a workshop, a market) or else to storage; storage sends
  to whoever wants what it holds.
- **Walkers** from the town hall and markets hand out food and cloth to the
  homes they pass; the chapel's brings faith; a fire watch's, a healer's,
  and a watch house's keep down the risks; a builder's mends.
- Larger buildings unlock as the town grows (by residents, then citizens).
