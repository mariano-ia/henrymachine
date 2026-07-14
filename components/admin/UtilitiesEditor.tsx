"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addUtility,
  updateUtility,
  deleteUtility,
  type UtilityInput,
} from "@/app/admin/(app)/utilidades/actions";

export type UtilityRow = UtilityInput & { id: string; active: boolean; position: number };

const CATEGORIES = [
  "Baños",
  "Agua",
  "Transporte",
  "WiFi y carga",
  "Plata",
  "Emergencias",
  "Consejos",
];

const ta =
  "w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-500/20";

const EMPTY: UtilityInput = {
  category: "Baños",
  name: "",
  neighborhood: null,
  address: null,
  place_query: null,
  hours: null,
  is_free: true,
  henry_note: null,
};

function Fields({
  value,
  onChange,
  disabled,
}: {
  value: UtilityInput;
  onChange: (v: UtilityInput) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<UtilityInput>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <select
          value={value.category}
          onChange={(e) => set({ category: e.target.value })}
          disabled={disabled}
          className={ta}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          disabled={disabled}
          placeholder="Nombre (ej: Bryant Park)"
          className={`${ta} sm:col-span-2`}
        />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <input
          value={value.neighborhood ?? ""}
          onChange={(e) => set({ neighborhood: e.target.value || null })}
          disabled={disabled}
          placeholder="Zona (vacío = toda la ciudad)"
          className={ta}
        />
        <input
          value={value.address ?? ""}
          onChange={(e) => set({ address: e.target.value || null })}
          disabled={disabled}
          placeholder="Dirección (opcional)"
          className={ta}
        />
        <input
          value={value.place_query ?? ""}
          onChange={(e) => set({ place_query: e.target.value || null })}
          disabled={disabled}
          placeholder="Lugar para Maps (opcional)"
          className={ta}
        />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto]">
        <input
          value={value.hours ?? ""}
          onChange={(e) => set({ hours: e.target.value || null })}
          disabled={disabled}
          placeholder="Horario (opcional, ej: 7:00–22:00)"
          className={ta}
        />
        <label className="flex items-center gap-2 px-1 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={value.is_free}
            onChange={(e) => set({ is_free: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4"
          />
          Gratis
        </label>
      </div>
      <textarea
        value={value.henry_note ?? ""}
        onChange={(e) => set({ henry_note: e.target.value || null })}
        disabled={disabled}
        rows={2}
        placeholder='Nota de Henry (su consejo, en su voz: "pide el código con una sonrisa…")'
        className={ta}
      />
    </div>
  );
}

function Row({ row }: { row: UtilityRow }) {
  const router = useRouter();
  const [value, setValue] = useState<UtilityInput>(row);
  const [active, setActive] = useState(row.active);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    start(async () => {
      const r = await updateUtility(row.id, { ...value, active });
      setMsg(r.ok ? "Guardado." : r.error ?? "Error");
      if (r.ok) router.refresh();
    });
  }
  function remove() {
    if (!confirm(`¿Borrar "${value.name}" de la guía?`)) return;
    start(async () => {
      const r = await deleteUtility(row.id);
      if (!r.ok) setMsg(r.error ?? "Error");
      else router.refresh();
    });
  }

  return (
    <li className={"rounded-2xl border border-white/10 bg-neutral-900/40 p-4" + (active ? "" : " opacity-50")}>
      <Fields value={value} onChange={setValue} disabled={pending} />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-3.5 w-3.5" />
          activo (Henry lo usa)
        </label>
        <button
          onClick={remove}
          disabled={pending}
          className="ml-auto text-sm text-red-400/70 transition hover:text-red-400 disabled:opacity-40"
        >
          Borrar
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-neutral-400">{msg}</p>}
    </li>
  );
}

export default function UtilitiesEditor({ rows }: { rows: UtilityRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<UtilityInput>(EMPTY);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function add() {
    if (!draft.name.trim()) {
      setMsg("Poné al menos un nombre.");
      return;
    }
    start(async () => {
      const r = await addUtility({ ...draft, name: draft.name.trim() });
      if (!r.ok) setMsg(r.error ?? "Error");
      else {
        setDraft(EMPTY);
        setMsg("Agregado.");
        router.refresh();
      }
    });
  }

  const byCategory = new Map<string, UtilityRow[]>();
  for (const r of rows) {
    (byCategory.get(r.category) ?? byCategory.set(r.category, []).get(r.category)!).push(r);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-white">Guía útil</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Baños, agua, transporte, plata… Henry usa esta guía en <b>todas</b> las experiencias
        cuando le preguntan algo práctico. Prioriza lo de la zona donde está el usuario;
        lo sin zona vale en toda la ciudad.
      </p>

      {/* alta */}
      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Agregar entrada</h2>
        <Fields value={draft} onChange={setDraft} disabled={pending} />
        <button
          onClick={add}
          disabled={pending}
          className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
        >
          {pending ? "Agregando…" : "Agregar"}
        </button>
        {msg && <p className="text-xs text-neutral-400">{msg}</p>}
      </div>

      {/* listado por categoría */}
      {[...byCategory.entries()].map(([cat, items]) => (
        <section key={cat}>
          <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-neutral-500">
            {cat} ({items.length})
          </h2>
          <ul className="space-y-3">
            {items.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </ul>
        </section>
      ))}
      {rows.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">
          Todavía no hay entradas (las semillas vienen con la migración 0008).
        </p>
      )}
    </div>
  );
}
