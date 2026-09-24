// The runnable-cell harness (src/runtime/live.ts) executed for real: the
// Python program the reader runs in Pyodide is run here with the python3 on
// PATH (CI installs numpy and matplotlib from requirements-test.txt) against
// small cells, and its JSON result is checked. Guards the figure capture:
// every open figure in creation order, and an Animation held in the cell's
// globals rendered as a frame sequence under the frame cap and the payload
// budget.

import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { FRAME_CAP, HARNESS, PAYLOAD_BUDGET } from "./runtime/live.ts";

interface Fig {
  kind: "svg" | "anim";
  data?: string;
  fmt?: "svg" | "png";
  frames?: string[];
  bytes?: number;
  interval?: number;
}
interface Result {
  out: string;
  figs: Fig[];
}

const python = Bun.which("python3") ?? Bun.which("python");

async function harness(cell: string): Promise<Result> {
  if (!python) throw new Error("python3 is not on PATH");
  const program = `${HARNESS}\nimport sys\nsys.stdout.write(__run_user_code(${JSON.stringify(cell)}, "{}"))\n`;
  const proc = Bun.spawn([python, "-c", program], {
    cwd: tmpdir(),
    env: { ...process.env, MPLBACKEND: "Agg" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`harness exit ${code}\n${stderr}`);
  return JSON.parse(stdout) as Result;
}

const size = (svg: string) => svg.match(/<svg[^>]*\swidth="([^"]+)"[^>]*\sheight="([^"]+)"/)?.slice(1).join("x");

test("every open figure is captured, in creation order", async () => {
  const r = await harness(`
import matplotlib.pyplot as plt
plt.figure(); plt.title("first figure")
plt.figure(); plt.title("second figure")
print("done")
`);
  expect(r.out).toBe("done\n");
  expect(r.figs.map((f) => f.kind)).toEqual(["svg", "svg"]);
  expect(r.figs[0].data).toContain("first figure");
  expect(r.figs[1].data).toContain("second figure");
}, 45_000);

test("a FuncAnimation becomes at most FRAME_CAP SVG frames of one size", async () => {
  const r = await harness(`
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
plt.figure(); plt.title("static before")
fig, ax = plt.subplots()
x = np.linspace(0, 6, 100)
line, = ax.plot(x, np.sin(x))
def update(k):
    line.set_ydata(np.sin(x + k / 10))
    ax.set_title(f"step {k}")
anim = FuncAnimation(fig, update, frames=200, interval=50)
`);
  expect(r.figs.map((f) => f.kind)).toEqual(["svg", "anim"]);
  const anim = r.figs[1];
  expect(FRAME_CAP).toBe(60);
  expect(anim.frames!.length).toBe(FRAME_CAP);
  expect(anim.fmt).toBe("svg");
  expect(anim.interval).toBe(50);
  expect(anim.frames![0]).toContain("step 0");
  expect(anim.frames![FRAME_CAP - 1]).toContain(`step ${FRAME_CAP - 1}`);
  expect(new Set(anim.frames!.map(size)).size).toBe(1);
}, 45_000);

test("an ArtistAnimation plays its artists in order", async () => {
  const r = await harness(`
import matplotlib.pyplot as plt
from matplotlib.animation import ArtistAnimation
fig, ax = plt.subplots()
frames = [[ax.text(0.5, 0.5, f"artist {i}")] for i in range(5)]
anim = ArtistAnimation(fig, frames, interval=100)
`);
  expect(r.figs.length).toBe(1);
  expect(r.figs[0].frames!.length).toBe(5);
  r.figs[0].frames!.forEach((f, i) => expect(f).toContain(`artist ${i}`));
}, 45_000);

test("a heavy animation switches to PNG and stays within the payload budget", async () => {
  const r = await harness(`
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
rng = np.random.default_rng(0)
fig, ax = plt.subplots()
pts = ax.scatter(*rng.normal(size=(2, 4000)), s=4)
ax.set_xlim(-4, 4); ax.set_ylim(-4, 4)
def update(k):
    pts.set_offsets(rng.normal(size=(4000, 2)) * (1 + k / 60))
anim = FuncAnimation(fig, update, frames=80)
`);
  const anim = r.figs[0];
  expect(anim.kind).toBe("anim");
  expect(anim.fmt).toBe("png");
  expect(anim.frames!.length).toBeGreaterThan(1);
  expect(anim.frames!.length).toBeLessThanOrEqual(FRAME_CAP);
  expect(anim.bytes!).toBeLessThanOrEqual(PAYLOAD_BUDGET);
  expect(anim.frames!.reduce((n, f) => n + f.length, 0)).toBe(anim.bytes!);
}, 45_000);

test("an error raised while drawing frames is reported under the output", async () => {
  const r = await harness(`
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
fig, ax = plt.subplots()
def update(k):
    if k == 3:
        raise ValueError("frame three")
anim = FuncAnimation(fig, update, frames=10)
print("before")
`);
  expect(r.out).toStartWith("before\n");
  expect(r.out).toContain("ValueError: frame three");
  expect(r.figs).toEqual([]);
}, 45_000);
