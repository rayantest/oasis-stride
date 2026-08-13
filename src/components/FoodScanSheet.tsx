import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeFoodPhoto, type FoodPhotoResult } from "@/lib/ai-parse.functions";
import { toast } from "sonner";
import {
  Camera, Loader2, X, Send, Plus, Bookmark, Sparkles, Upload,
} from "lucide-react";

type ChatTurn = { role: "user" | "assistant"; content: string };

async function fileToDataUrl(file: File): Promise<string> {
  // Downscale to keep the payload small
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function FoodScanSheet({ open, onClose, logTimestamp, dateHint, onLogged }: {
  open: boolean;
  onClose: () => void;
  logTimestamp: () => string;
  dateHint: string;
  onLogged: () => void;
}) {
  const analyze = useServerFn(analyzeFoodPhoto);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [result, setResult] = useState<FoodPhotoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [saveName, setSaveName] = useState("");

  const reset = () => {
    setImageDataUrl(null); setComment(""); setFollowUp("");
    setHistory([]); setResult(null); setSaveToLibrary(false); setSaveName("");
  };


  const close = () => { reset(); onClose(); };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      setImageDataUrl(url);
      setResult(null);
      setHistory([]);
    } catch {
      toast.error("Couldn't read that image.");
    }
  };

  const run = async (nextHistory: ChatTurn[]) => {
    if (!imageDataUrl) return;
    setBusy(true);
    try {
      const out = await analyze({
        data: { imageDataUrl, comment: comment.trim() || undefined, history: nextHistory },
      });
      setResult(out);
      setHistory([...nextHistory, { role: "assistant", content: JSON.stringify(out) }]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const sendFollowUp = async () => {
    if (!followUp.trim() || busy) return;
    const turn: ChatTurn = { role: "user", content: followUp.trim() };
    setFollowUp("");
    await run([...history, turn]);
  };

  const add = async () => {
    if (!result || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("food_entries").insert({
        label: result.label,
        kcal: result.kcal,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fat_g: result.fat_g,
        saturated_fat_g: result.saturated_fat_g,
        monounsaturated_fat_g: result.monounsaturated_fat_g,
        polyunsaturated_fat_g: result.polyunsaturated_fat_g,
        sugar_g: result.sugar_g,
        fiber_g: result.fiber_g,
        starch_g: result.starch_g,
        sodium_mg: result.sodium_mg,
        trans_fat_g: result.trans_fat_g,
        cholesterol_mg: result.cholesterol_mg,
        animal_protein_g: result.animal_protein_g,
        plant_protein_g: result.plant_protein_g,
        created_at: logTimestamp(),
      });
      if (error) throw error;
      if (saveToLibrary) {
        await supabase.from("saved_foods").insert({
          label: saveName.trim() || result.label,
          grams: result.total_grams,
          kcal: result.kcal,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
          saturated_fat_g: result.saturated_fat_g,
          monounsaturated_fat_g: result.monounsaturated_fat_g,
          polyunsaturated_fat_g: result.polyunsaturated_fat_g,
          sugar_g: result.sugar_g,
          fiber_g: result.fiber_g,
          starch_g: result.starch_g,
          sodium_mg: result.sodium_mg,
          trans_fat_g: result.trans_fat_g,
          cholesterol_mg: result.cholesterol_mg,
          animal_protein_g: result.animal_protein_g,
          plant_protein_g: result.plant_protein_g,
          breakdown: result.items,
        });
      }
      toast.success(`Logged ${result.label} · ${result.kcal} kcal`);
      close();
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  if (!open) return null;

  const userTurns = history.filter(h => h.role === "user");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-border/60 shadow-[var(--shadow-card)]">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-card/95 backdrop-blur border-b border-border/40">
          <span className="text-[11px] uppercase tracking-widest text-sand flex items-center gap-1.5">
            <Camera size={13} /> Scan food
          </span>
          <button onClick={close} className="p-1.5 rounded-full hover:bg-muted/50" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { pick(e.target.files?.[0]); if (cameraRef.current) cameraRef.current.value = ""; }}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { pick(e.target.files?.[0]); if (uploadRef.current) uploadRef.current.value = ""; }}
          />

          {imageDataUrl ? (
            <div className="relative">
              <img src={imageDataUrl} alt="Food to analyse" className="w-full rounded-2xl object-cover max-h-64" />
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 border border-border/60 text-[11px]">
                  <Camera size={12} /> Camera
                </button>
                <button
                  onClick={() => uploadRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 border border-border/60 text-[11px]">
                  <Upload size={12} /> Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="aspect-[4/3] rounded-2xl border border-dashed border-border/70 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-sand/60 hover:text-sand transition-colors">
                <Camera size={28} />
                <span className="text-xs font-medium">Camera</span>
              </button>
              <button
                onClick={() => uploadRef.current?.click()}
                className="aspect-[4/3] rounded-2xl border border-dashed border-border/70 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-sand/60 hover:text-sand transition-colors">
                <Upload size={28} />
                <span className="text-xs font-medium">Upload</span>
              </button>
            </div>
          )}

          <textarea
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder='Optional notes — e.g. "grilled chicken breast, cooked in olive oil, no rice"'
            className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
          />

          {!result && (
            <button
              onClick={() => run([])}
              disabled={!imageDataUrl || busy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sand text-primary-foreground text-sm font-semibold disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Analyse
            </button>
          )}

          {result && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{result.label}</h3>
                <span className={`shrink-0 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  result.confidence === "high" ? "border-oasis/50 text-oasis"
                  : result.confidence === "low" ? "border-destructive/50 text-destructive"
                  : "border-sand/50 text-sand"}`}>
                  {result.confidence} confidence
                </span>
              </div>

              <ul className="space-y-1">
                {result.items.map((it, i) => (
                  <li key={i} className="text-[11px] leading-snug text-muted-foreground">
                    <span className="text-foreground">{it.name}</span>
                    {it.grams ? ` (${it.grams}g)` : ""}: {it.kcal} kcal · {it.protein_g}P / {it.carbs_g}C / {it.fat_g}F
                    {(it.saturated_fat_g > 0 || it.sugar_g > 0 || it.fiber_g > 0 || it.sodium_mg > 0 || it.animal_protein_g > 0 || it.plant_protein_g > 0) && (
                      <span className="block text-[10px] text-muted-foreground/70">
                        {[
                          it.saturated_fat_g > 0 && `${it.saturated_fat_g}g sat fat`,
                          (it.monounsaturated_fat_g + it.polyunsaturated_fat_g) > 0 && `${it.monounsaturated_fat_g + it.polyunsaturated_fat_g}g unsat fat`,
                          it.sugar_g > 0 && `${it.sugar_g}g sugar`,
                          it.fiber_g > 0 && `${it.fiber_g}g fiber`,
                          it.starch_g > 0 && `${it.starch_g}g starch`,
                          it.sodium_mg > 0 && `${it.sodium_mg}mg sodium`,
                          it.animal_protein_g > 0 && `${it.animal_protein_g}g animal protein`,
                          it.plant_protein_g > 0 && `${it.plant_protein_g}g plant protein`,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="pt-2 border-t border-border/40 grid grid-cols-4 gap-2 text-center">
                {[
                  ["Kcal", `${result.kcal}`],
                  ["Protein", `${result.protein_g}g`],
                  ["Carbs", `${result.carbs_g}g`],
                  ["Fat", `${result.fat_g}g`],
                  ["Animal P", `${result.animal_protein_g}g`],
                  ["Plant P", `${result.plant_protein_g}g`],
                  ["Sugar", `${result.sugar_g}g`],
                  ["Fiber", `${result.fiber_g}g`],
                  ["Sat fat", `${result.saturated_fat_g}g`],
                  ["Unsat fat", `${result.monounsaturated_fat_g + result.polyunsaturated_fat_g}g`],
                  ["Sodium", `${result.sodium_mg}mg`],
                  ["Grams", `${result.total_grams}g`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-sm font-semibold">{v}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>

              {result.note && <p className="text-[10px] text-muted-foreground italic">{result.note}</p>}

              {userTurns.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-1">
                  {userTurns.map((t, i) => (
                    <div key={i} className="text-[10px] text-sand">↳ you: {t.content}</div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendFollowUp(); } }}
                  placeholder='Correct it — e.g. "I used 2 tbsp olive oil"'
                  className="flex-1 bg-input/50 border border-border/50 rounded-full px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={sendFollowUp}
                  disabled={busy || !followUp.trim()}
                  className="p-2 rounded-full bg-muted/60 disabled:opacity-40" aria-label="Send correction">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}

          {result && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={e => setSaveToLibrary(e.target.checked)}
                  className="accent-[hsl(var(--sand,40_50%_60%))]"
                />
                <Bookmark size={13} /> Save to my foods for one-tap logging later
              </label>
              {saveToLibrary && (
                <input
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder={result.label}
                  className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">{dateHint}</span>
                <button
                  onClick={add}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold disabled:opacity-40">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
