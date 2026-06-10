import { create } from 'zustand'
import defaultMushrooms from '../data/mushrooms.json'
import type { BestTeam, Mushroom, MushroomInstance, Stats } from '../types'

const STORAGE_KEY = 'nameko-team-builder-v173'
const LEGACY_KEYS = ['nameko-team-builder-v171','nameko-team-builder-v17']

interface AppState {
  tab: 'stages' | 'mushrooms' | 'results' | 'settings'
  selectedStageId: string
  selectedRouteId: string
  mushrooms: Mushroom[]
  instances: MushroomInstance[]
  allowDuplicate: boolean
  bestTeams: BestTeam[]
  searched: number
  showAllTeams: boolean
  query: string
  setTab: (tab: AppState['tab']) => void
  setStageRoute: (stageId: string, routeId: string) => void
  addMushroom: (mushroom: Mushroom) => void
  updateMushroom: (mushroom: Mushroom) => void
  deleteMushroom: (id: string) => void
  toggleEnabled: (id: string) => void
  setStat: (id: string, stat: keyof Stats, value: number) => void
  adjustStat: (id: string, stat: keyof Stats, delta: number) => void
  toggleSkill: (id: string, skillId: string) => void
  selectAll: (enabled: boolean) => void
  resetMushroom: (id: string) => void
  setAllowDuplicate: (v: boolean) => void
  setBestTeams: (teams: BestTeam[], searched: number) => void
  setShowAllTeams: (v: boolean) => void
  setQuery: (q: string) => void
  exportData: () => string
  importData: (json: string) => void
  clearAll: () => void
}

function loadPartial(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key)
      if (legacy) return JSON.parse(legacy)
    }
    return {}
  } catch {
    return {}
  }
}

function normalizeMushroom(m: any): Mushroom {
  return {
    id: String(m.id ?? `custom_${Date.now()}`),
    no: m.no,
    name: String(m.name ?? ''),
    rarity: m.rarity,
    favorite: m.favorite,
    image: m.image ?? m.imageUrl ?? '',
    imageUrl: m.imageUrl,
    stats: {
      red: Number(m.stats?.red ?? m.red ?? 0),
      blue: Number(m.stats?.blue ?? m.blue ?? 0),
      green: Number(m.stats?.green ?? m.green ?? 0)
    },
    skills: Array.isArray(m.skills) ? m.skills : []
  }
}

function makeInstance(m: Mushroom): MushroomInstance {
  return {
    mushroomId: m.id,
    enabled: true,
    customStats: { ...m.stats },
    enabledSkillIds: [...(m.skills ?? [])]
  }
}

function mergeInstances(mushrooms: Mushroom[], saved?: MushroomInstance[]) {
  return mushrooms.map(m => {
    const existing = saved?.find(i => i.mushroomId === m.id)
    return existing ? {
      ...makeInstance(m),
      ...existing,
      customStats: existing.customStats ?? m.stats,
      enabledSkillIds: Array.isArray(existing.enabledSkillIds) ? existing.enabledSkillIds : (m.skills ?? [])
    } : makeInstance(m)
  })
}

function save(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedStageId: state.selectedStageId,
    selectedRouteId: state.selectedRouteId,
    mushrooms: state.mushrooms,
    instances: state.instances,
    allowDuplicate: state.allowDuplicate
  }))
}

const loaded = typeof localStorage === 'undefined' ? {} : loadPartial()
const bundledMushrooms = (defaultMushrooms as any[]).map(normalizeMushroom)
const savedMushrooms = Array.isArray(loaded.mushrooms) ? (loaded.mushrooms as any[]).map(normalizeMushroom) : []
const initialMushrooms = savedMushrooms.length > 0 ? savedMushrooms : bundledMushrooms

export const useAppStore = create<AppState>((set, get) => ({
  tab: 'stages',
  selectedStageId: loaded.selectedStageId ?? 'mole_cave',
  selectedRouteId: loaded.selectedRouteId ?? 'entrance',
  mushrooms: initialMushrooms,
  instances: mergeInstances(initialMushrooms, loaded.instances as MushroomInstance[] | undefined),
  allowDuplicate: loaded.allowDuplicate ?? false,
  bestTeams: [],
  searched: 0,
  showAllTeams: false,
  query: '',

  setTab: tab => set({ tab }),
  setStageRoute: (selectedStageId, selectedRouteId) => setAndSave(set, get, { selectedStageId, selectedRouteId, bestTeams: [], showAllTeams: false }),
  addMushroom: mushroom => {
    const normalized = normalizeMushroom(mushroom)
    const mushrooms = [...get().mushrooms, normalized]
    const instances = [...get().instances, makeInstance(normalized)]
    setAndSave(set, get, { mushrooms, instances, bestTeams: [] })
  },
  updateMushroom: mushroom => {
    const normalized = normalizeMushroom(mushroom)
    const mushrooms = get().mushrooms.map(m => m.id === normalized.id ? normalized : m)
    const instances = mergeInstances(mushrooms, get().instances)
    setAndSave(set, get, { mushrooms, instances, bestTeams: [] })
  },
  deleteMushroom: id => {
    const mushrooms = get().mushrooms.filter(m => m.id !== id)
    const instances = get().instances.filter(i => i.mushroomId !== id)
    setAndSave(set, get, { mushrooms, instances, bestTeams: [] })
  },
  toggleEnabled: id => setAndSave(set, get, { instances: get().instances.map(i => i.mushroomId === id ? { ...i, enabled: !i.enabled } : i), bestTeams: [] }),
  setStat: (id, stat, value) => setAndSave(set, get, { instances: get().instances.map(i => i.mushroomId === id ? { ...i, customStats: { ...i.customStats, [stat]: Math.max(0, value) } } : i), bestTeams: [] }),
  adjustStat: (id, stat, delta) => {
    const inst = get().instances.find(i => i.mushroomId === id)
    const current = inst?.customStats[stat] ?? 0
    get().setStat(id, stat, current + delta)
  },
  toggleSkill: (id, skillId) => setAndSave(set, get, { instances: get().instances.map(i => {
    if (i.mushroomId !== id) return i
    const has = i.enabledSkillIds.includes(skillId)
    return { ...i, enabledSkillIds: has ? i.enabledSkillIds.filter(s => s !== skillId) : [...i.enabledSkillIds, skillId] }
  }), bestTeams: [] }),
  selectAll: enabled => setAndSave(set, get, { instances: get().instances.map(i => ({ ...i, enabled })), bestTeams: [] }),
  resetMushroom: id => {
    const original = get().mushrooms.find(m => m.id === id)
    if (!original) return
    setAndSave(set, get, { instances: get().instances.map(i => i.mushroomId === id ? makeInstance(original) : i), bestTeams: [] })
  },
  setAllowDuplicate: allowDuplicate => setAndSave(set, get, { allowDuplicate, bestTeams: [] }),
  setBestTeams: (bestTeams, searched) => set({ bestTeams, searched, showAllTeams: false, tab: 'results' }),
  setShowAllTeams: showAllTeams => set({ showAllTeams }),
  setQuery: query => set({ query }),
  exportData: () => JSON.stringify({ mushrooms: get().mushrooms, instances: get().instances, allowDuplicate: get().allowDuplicate }, null, 2),
  importData: json => {
    const parsed = JSON.parse(json)
    const mushrooms = Array.isArray(parsed.mushrooms) ? parsed.mushrooms.map(normalizeMushroom) : []
    const instances = mergeInstances(mushrooms, parsed.instances)
    setAndSave(set, get, { mushrooms, instances, allowDuplicate: !!parsed.allowDuplicate, bestTeams: [] })
  },
  clearAll: () => setAndSave(set, get, { mushrooms: [], instances: [], bestTeams: [] })
}))

function setAndSave(set: any, get: any, patch: Partial<AppState>) {
  set(patch)
  save(get())
}
