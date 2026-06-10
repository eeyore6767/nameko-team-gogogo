import type { BestTeam, Mission, MissionCheck, Mushroom, MushroomInstance, Requirement, Route, Skill, StatKey, Stats, TeamMember } from '../types'

const statName: Record<StatKey, string> = { red: '紅', blue: '藍', green: '綠' }

export function getSkillName(id: string, skills: Skill[]) {
  return skills.find(s => s.id === id)?.name ?? id
}

function baseStat(m: TeamMember, stat: StatKey) {
  return m.stats[stat] ?? 0
}

function bonusForMember(m: TeamMember, req: any, stat: StatKey) {
  if (!req.bonusSkill || req.bonusStat !== stat) return 0
  return m.skills.includes(req.bonusSkill) ? (req.bonusValue ?? 0) : 0
}

function statWithBonus(m: TeamMember, req: any, stat: StatKey) {
  return baseStat(m, stat) + bonusForMember(m, req, stat)
}

function hasAllMembersSkill(team: TeamMember[], skill: string) {
  return team.length > 0 && team.every(m => m.skills.includes(skill))
}

function extraTeamBonus(team: TeamMember[], req: any, stat: StatKey) {
  if (req.allHaveSkill && req.bonusStat === stat && hasAllMembersSkill(team, req.allHaveSkill)) {
    return (req.bonusValue ?? 0) * team.length
  }
  if (req.bonusSkill && req.bonusStat === stat) {
    return team.reduce((sum, m) => sum + (m.skills.includes(req.bonusSkill) ? (req.bonusValue ?? 0) : 0), 0)
  }
  return 0
}

function checkRequirement(req: Requirement, team: TeamMember[], skills: Skill[]): { passed: boolean; reason: string } {
  if (req.type === 'single') {
    const count = req.count ?? 1
    const values = team.map(m => statWithBonus(m, req, req.stat)).sort((a, b) => b - a)
    const okCount = values.filter(v => v >= req.value).length
    const label = `有 ${count} 隻${statName[req.stat]}值 ${req.value}${formatBonus(req, skills)}`
    if (okCount >= count) return { passed: true, reason: label }
    const best = values[0] ?? 0
    return { passed: false, reason: `${label}，目前最高 ${best}，缺 ${Math.max(0, req.value - best)}` }
  }

  if (req.type === 'memberCount') {
    const values = team.map(m => statWithBonus(m, req, req.stat)).sort((a, b) => b - a)
    const okCount = values.filter(v => v >= req.value).length
    const label = `有 ${req.count} 隻${statName[req.stat]}值 ${req.value}${formatBonus(req, skills)}`
    if (okCount >= req.count) return { passed: true, reason: label }
    return { passed: false, reason: `${label}，目前 ${okCount} 隻達標，缺 ${req.count - okCount} 隻` }
  }

  if (req.type === 'teamTotal') {
    const total = team.reduce((sum, m) => sum + baseStat(m, req.stat), 0) + extraTeamBonus(team, req, req.stat)
    const label = `總${statName[req.stat]}值 ${req.value}${formatBonus(req, skills)}`
    if (total >= req.value) return { passed: true, reason: label }
    return { passed: false, reason: `${label}，目前 ${total}，缺 ${req.value - total}` }
  }

  if (req.type === 'multiStat') {
    const entries = Object.entries(req.requirements) as [StatKey, number][]
    const label = `同一隻達到 ${entries.map(([k, v]) => `${statName[k]}${v}`).join('、')}${formatBonus(req, skills)}`
    const ok = team.some(m => entries.every(([k, v]) => statWithBonus(m, req, k) >= v))
    if (ok) return { passed: true, reason: label }
    return { passed: false, reason: `${label}，目前沒有菇菇同時達標` }
  }

  if (req.type === 'hasSkill') {
    const name = getSkillName(req.skill, skills)
    const ok = team.some(m => m.skills.includes(req.skill))
    return { passed: ok, reason: ok ? `擁有技能：${name}` : `缺少技能：${name}` }
  }

  if (req.type === 'hasSkills') {
    const names = req.skills.map(id => getSkillName(id, skills)).join('、')
    const ok = team.some(m => req.skills.every(id => m.skills.includes(id)))
    return { passed: ok, reason: ok ? `同一隻擁有技能：${names}` : `缺少同一隻同時擁有：${names}` }
  }

  return { passed: false, reason: '未知條件' }
}

function formatBonus(req: any, skills: Skill[]) {
  if (req.allHaveSkill) return `（全員${getSkillName(req.allHaveSkill, skills)} +${req.bonusValue ?? 0}）`
  if (req.bonusSkill) return `（${getSkillName(req.bonusSkill, skills)} +${req.bonusValue ?? 0}）`
  return ''
}

export function formatRequirement(req: Requirement, skills: Skill[]) {
  return checkRequirement(req, [], skills).reason.replace(/，目前.*/, '')
}

export function evaluateMission(mission: Mission, team: TeamMember[], skills: Skill[]): MissionCheck {
  const checks = mission.requirements.map(req => checkRequirement(req, team, skills))
  const failed = checks.find(c => !c.passed)
  return {
    mission,
    passed: !failed,
    reason: failed ? failed.reason : checks.map(c => c.reason).join('；')
  }
}

export function evaluateTeam(team: TeamMember[], route: Route, skills: Skill[]): BestTeam {
  const checks = route.missions.map(m => evaluateMission(m, team, skills))
  const total: Stats = {
    red: team.reduce((s, m) => s + m.stats.red, 0),
    blue: team.reduce((s, m) => s + m.stats.blue, 0),
    green: team.reduce((s, m) => s + m.stats.green, 0)
  }
  return {
    members: [...team],
    team: [...team],
    mushrooms: [...team],
    memberNames: team.map(m => m.name),
    completed: checks.filter(c => c.passed),
    failed: checks.filter(c => !c.passed),
    score: checks.filter(c => c.passed).length,
    total
  }
}

function getInstance(mushroom: Mushroom, instances: MushroomInstance[]) {
  return instances.find(i => i.mushroomId === mushroom.id) ?? {
    mushroomId: mushroom.id,
    enabled: true,
    customStats: mushroom.stats,
    enabledSkillIds: mushroom.skills
  }
}

export function makeTeamMembers(mushrooms: Mushroom[], instances: MushroomInstance[], allowDuplicate: boolean): TeamMember[] {
  const pool: TeamMember[] = []
  for (const mushroom of mushrooms) {
    const inst = getInstance(mushroom, instances)
    if (!inst.enabled) continue
    const count = allowDuplicate ? 2 : 1
    for (let i = 0; i < count; i++) {
      pool.push({
        key: `${mushroom.id}-${i}`,
        mushroomId: mushroom.id,
        name: mushroom.name,
        stats: inst.customStats,
        skills: inst.enabledSkillIds,
        image: mushroom.image || mushroom.imageUrl
      })
    }
  }
  return pool
}

export function findBestTeams(mushrooms: Mushroom[], instances: MushroomInstance[], route: Route, skills: Skill[], allowDuplicate: boolean) {
  const pool = makeTeamMembers(mushrooms, instances, allowDuplicate)
  const limit = route.teamLimit
  const results: BestTeam[] = []
  let searched = 0

  function dfs(start: number, current: TeamMember[]) {
    if (current.length === limit) {
      searched++
      results.push(evaluateTeam(current, route, skills))
      return
    }
    for (let i = start; i < pool.length; i++) {
      current.push(pool[i])
      dfs(i + 1, current)
      current.pop()
    }
  }

  dfs(0, [])
  if (results.length === 0) return { bestTeams: [], searched }
  const bestScore = Math.max(...results.map(r => r.score))
  const bestTeams = results
    .filter(r => r.score === bestScore)
    .sort((a, b) => (b.total.red + b.total.blue + b.total.green) - (a.total.red + a.total.blue + a.total.green))
  return { bestTeams, searched }
}

export function teamSignature(team: BestTeam) {
  const counts = new Map<string, number>()
  for (const m of team.members) counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
  return [...counts.entries()].map(([name, count]) => count > 1 ? `${name} x${count}` : name).join('、')
}
