import { FFmpeg } from "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile } from "https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js";

const fileEl = document.getElementById("file");
const vbEl = document.getElementById("vb");
const maxwEl = document.getElementById("maxw");
const goEl = document.getElementById("go");
const progEl = document.getElementById("prog");
const statusEl = document.getElementById("status");
const outEl = document.getElementById("out");

const ffmpeg = new FFmpeg();

function humanBytes(bytes) {
  const units = ["B","KB","MB","GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

async function ensureLoaded() {
  if (ffmpeg.loaded) return;
  statusEl.textContent = "Loading compressor (first time can take a bit)…";
  ffmpeg.on("progress", (p) => {
    progEl.value = Math.max(0, Math.min(1, p.progress ?? 0));
  });
  await ffmpeg.load();
}

goEl.addEventListener("click", async () => {
  const f = fileEl.files?.[0];
  if (!f) { alert("Pick a video file first."); return; }

  goEl.disabled = true;
  outEl.innerHTML = "";
  progEl.value = 0;

  try {
    await ensureLoaded();

    const inName = "input";
    const outName = "output.mp4";

    statusEl.textContent = `Reading file (${humanBytes(f.size)})…`;
    await ffmpeg.writeFile(inName, await fetchFile(f));

    const vb = Number(vbEl.value || 1200);
    const maxw = Number(maxwEl.value || 0);

    // Scale only if maxw > 0 (keeps aspect ratio). Otherwise keep original.
    const vf = maxw > 0 ? `scale='min(${maxw},iw)':-2` : null;

    statusEl.textContent = "Compressing…";
    const args = [
      "-i", inName,
      ...(vf ? ["-vf", vf] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", `${vb}k`,
      "-maxrate", `${Math.round(vb * 1.2)}k`,
      "-bufsize", `${Math.round(vb * 2)}k`,
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "128k",
      outName
    ];

    await ffmpeg.exec(args);

    statusEl.textContent = "Preparing download…";
    const data = await ffmpeg.readFile(outName);
    const blob = new Blob([data.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const newSize = blob.size;
    const pct = ((1 - newSize / f.size) * 100);
    outEl.innerHTML = `
      <div>Original: <code>${humanBytes(f.size)}</code></div>
      <div>Compressed: <code>${humanBytes(newSize)}</code> (${isFinite(pct) ? pct.toFixed(1) : "?"}% smaller)</div>
      <div style="margin-top:10px;">
        <a href="${url}" download="compressed.mp4">Download compressed video</a>
      </div>
    `;
    statusEl.textContent = "Done.";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Error: " + (e?.message ?? String(e));
  } finally {
    goEl.disabled = false;
  }
});
