export type StatKey = 'red' | 'blue' | 'green'
export type Stats = Record<StatKey, number>

export interface Mushroom {
  id: string
  no?: string
  name: string
  rarity?: string
  favorite?: string
  image?: string
  imageUrl?: string
  stats: Stats
  skills: string[]
}

export interface MushroomInstance {
  mushroomId: string
  enabled: boolean
  customStats: Stats
  enabledSkillIds: string[]
}

export interface Skill {
  id: string
  name: string
  icon?: string
}

export type Requirement =
  | { type: 'single'; stat: StatKey; value: number; count?: number; bonusSkill?: string; bonusStat?: StatKey; bonusValue?: number }
  | { type: 'memberCount'; stat: StatKey; value: number; count: number; bonusSkill?: string; bonusStat?: StatKey; bonusValue?: number }
  | { type: 'teamTotal'; stat: StatKey; value: number; bonusSkill?: string; bonusStat?: StatKey; bonusValue?: number; allHaveSkill?: string }
  | { type: 'multiStat'; requirements: Partial<Stats>; bonusSkill?: string; bonusStat?: StatKey; bonusValue?: number }
  | { type: 'hasSkill'; skill: string }
  | { type: 'hasSkills'; skills: string[] }

export interface Mission {
  name: string
  requirements: Requirement[]
}

export interface Route {
  id: string
  name: string
  teamLimit: number
  missions: Mission[]
}

export interface Stage {
  id: string
  name: string
  routes: Route[]
}

export interface TeamMember {
  key: string
  mushroomId: string
  name: string
  stats: Stats
  skills: string[]
  image?: string
}

export interface MissionCheck {
  mission: Mission
  passed: boolean
  reason: string
}

export interface BestTeam {
  members: TeamMember[]
  team?: TeamMember[]
  mushrooms?: TeamMember[]
  memberNames?: string[]
  completed: MissionCheck[]
  failed: MissionCheck[]
  score: number
  total: Stats
}
