# Cheeseburger — make.fun picture-tastes-01

[![make.fun bounty](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
[![make.fun rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/adiprmx/makefun-picture-tastes-01/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
[![make.fun reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/adiprmx/makefun-picture-tastes-01/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)

A program that draws one delicious cheeseburger — glossy sesame-topped bun,
cheese dripping over a grilled patty, tomato and lettuce on a white plate —
entirely procedurally, with its own framebuffer rasterizer and a pure-stdlib
PNG encoder. No image assets, no network, fully deterministic: two runs
produce byte-identical output.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024, PNG)
```

Entered on [make.fun](https://make.fun/r/1c6jcmp6) for the "The picture that
tastes of one ingredient" bounty.
