import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import stagesData from './data/stages.json'
import skillsData from './data/skills.json'
import { useAppStore } from './store/useAppStore'
import { findBestTeams, getSkillName, teamSignature } from './engine/calculator'
import type { BestTeam, Mushroom, Requirement, Route, Skill, StatKey, Stats, TeamMember } from './types'
import './style.css'

const stages = stagesData as any[]
const skills = skillsData as Skill[]
const statLabels: Record<StatKey, string> = { red: '紅', blue: '藍', green: '綠' }
const BASE = import.meta.env.BASE_URL
const statIconPaths: Record<StatKey, string> = { red: `${BASE}stats/red.png`, blue: `${BASE}stats/blue.png`, green: `${BASE}stats/green.png` }

function App() {
  const state = useAppStore()
  const stage = stages.find(s => s.id === state.selectedStageId) ?? stages[0]
  const route: Route = stage.routes.find((r: Route) => r.id === state.selectedRouteId) ?? stage.routes[0]

  const runBest = () => {
    const result = findBestTeams(state.mushrooms, state.instances, route, skills, state.allowDuplicate)
    state.setBestTeams(result.bestTeams, result.searched)
  }

  return <main>
    <header className="app-header">
      <h1>菇菇組隊計算機</h1>
      <p>{stage.name}・{route.name}｜上限 {route.teamLimit} 隻</p>
    </header>

    {state.tab === 'stages' && <StagePage route={route} />}
    {state.tab === 'mushrooms' && <MushroomPage />}
    {state.tab === 'results' && <ResultPage route={route} onRun={runBest} />}
    {state.tab === 'settings' && <SettingsPage />}

    <nav className="bottom-nav">
      <button className={state.tab === 'stages' ? 'active' : ''} onClick={() => state.setTab('stages')}>關卡</button>
      <button className={state.tab === 'mushrooms' ? 'active' : ''} onClick={() => state.setTab('mushrooms')}>菇菇</button>
      <button className={state.tab === 'results' ? 'active' : ''} onClick={() => state.setTab('results')}>結果</button>
      <button className={state.tab === 'settings' ? 'active' : ''} onClick={() => state.setTab('settings')}>設定</button>
    </nav>
  </main>
}

function StagePage({ route }: { route: Route }) {
  const state = useAppStore()
  return <section className="panel">
    <h2>關卡選擇</h2>
    <select value={`${state.selectedStageId}|${state.selectedRouteId}`} onChange={e => {
      const [s, r] = e.target.value.split('|')
      state.setStageRoute(s, r)
    }}>
      {stages.flatMap(s => s.routes.map((r: Route) => <option key={`${s.id}-${r.id}`} value={`${s.id}|${r.id}`}>{s.name} - {r.name}（上限 {r.teamLimit}）</option>))}
    </select>
    <label className="check-row">
      <input type="checkbox" checked={state.allowDuplicate} onChange={e => state.setAllowDuplicate(e.target.checked)} />
      允許重複派遣菇菇（同種最多 2 隻）
    </label>
    <div className="mission-list">
      <h3>任務條件</h3>
      {route.missions.map(m => <div className="mission" key={m.name}>
        <strong>{m.name}</strong>
        <div className="requirement-lines">{m.requirements.map((r, idx) => <RequirementView key={idx} req={r} />)}</div>
      </div>)}
    </div>
  </section>
}

function MushroomPage() {
  const state = useAppStore()
  const [editing, setEditing] = useState<Mushroom | null>(null)
  const visible = state.mushrooms.filter(m => m.name.includes(state.query) || m.id.includes(state.query) || (m.no ?? '').includes(state.query))

  return <>
    <section className="panel">
      <div className="title-actions">
        <h2>菇菇管理</h2>
        <button className="primary" onClick={() => setEditing(newEmptyMushroom())}>＋新增菇菇</button>
      </div>
      <div className="actions">
        <input className="search" value={state.query} onChange={e => state.setQuery(e.target.value)} placeholder="搜尋菇菇" />
        <button onClick={() => state.selectAll(true)}>全選</button>
        <button onClick={() => state.selectAll(false)}>全不選</button>
      </div>
      {state.mushrooms.length === 0 && <div className="empty">目前沒有菇菇。點「＋新增菇菇」開始建立自己的資料。</div>}
      <div className="grid">
        {visible.map(m => <MushroomCard key={m.id} mushroom={m} onEdit={() => setEditing(m)} />)}
      </div>
    </section>
    {editing && <MushroomEditor mushroom={editing} onClose={() => setEditing(null)} />}
  </>
}

function MushroomCard({ mushroom, onEdit }: { mushroom: Mushroom; onEdit: () => void }) {
  const { instances, toggleEnabled, toggleSkill, setStat, adjustStat, resetMushroom, deleteMushroom } = useAppStore()
  const inst = instances.find(i => i.mushroomId === mushroom.id) ?? {
    mushroomId: mushroom.id,
    enabled: true,
    customStats: mushroom.stats,
    enabledSkillIds: mushroom.skills ?? []
  }
  return <div className={`card ${inst.enabled ? 'on' : 'off'}`}>
    <label className="title-row"><input type="checkbox" checked={inst.enabled} onChange={() => toggleEnabled(mushroom.id)} /> <strong>{mushroom.no ? `${mushroom.no}. ` : ''}{mushroom.name}</strong></label>
    <div className="image-box">{mushroom.image ? <img src={mushroom.image} /> : <span>🍄</span>}</div>
    {(['red', 'blue', 'green'] as StatKey[]).map(k => <StatControl key={k} stat={k} value={inst.customStats[k]} onChange={v => setStat(mushroom.id, k, v)} onAdjust={d => adjustStat(mushroom.id, k, d)} />)}
    <div className="skills">
      <strong>攜帶技能</strong>
      {mushroom.skills.length === 0 && <p className="muted">無技能</p>}
      <div className="skill-grid small">
        {mushroom.skills.map(skillId => <button key={skillId} className={inst.enabledSkillIds.includes(skillId) ? 'skill selected' : 'skill'} onClick={() => toggleSkill(mushroom.id, skillId)} title={getSkillName(skillId, skills)}>
          <SkillIcon skillId={skillId} />
          <span>{getSkillName(skillId, skills)}</span>
        </button>)}
      </div>
    </div>
    <div className="actions compact card-actions">
      <button onClick={onEdit}>✏️ 編輯</button>
      <button onClick={() => resetMushroom(mushroom.id)}>重置</button>
      <button className="danger" onClick={() => confirm(`刪除 ${mushroom.name}？`) && deleteMushroom(mushroom.id)}>🗑️ 刪除</button>
    </div>
  </div>
}

function MushroomEditor({ mushroom, onClose }: { mushroom: Mushroom; onClose: () => void }) {
  const state = useAppStore()
  const isNew = !state.mushrooms.some(m => m.id === mushroom.id)
  const [draft, setDraft] = useState<Mushroom>({ ...mushroom, stats: { ...mushroom.stats }, skills: [...mushroom.skills] })

  const setStat = (key: StatKey, value: number) => setDraft({ ...draft, stats: { ...draft.stats, [key]: Math.max(0, value || 0) } })
  const toggleSkill = (id: string) => {
    const exists = draft.skills.includes(id)
    setDraft({ ...draft, skills: exists ? draft.skills.filter(s => s !== id) : [...draft.skills, id] })
  }
  const save = () => {
    if (!draft.name.trim()) return alert('請輸入菇菇名稱')
    isNew ? state.addMushroom(draft) : state.updateMushroom(draft)
    onClose()
  }

  return <div className="modal-backdrop">
    <div className="modal">
      <h2>{isNew ? '新增菇菇' : '編輯菇菇'}</h2>
      <label>名稱<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>編號<input value={draft.no ?? ''} onChange={e => setDraft({ ...draft, no: e.target.value })} placeholder="可留空" /></label>
      <label>圖片<input type="file" accept="image/*" onChange={async e => {
        const file = e.target.files?.[0]
        if (!file) return
        const dataUrl = await readFileAsDataUrl(file)
        setDraft({ ...draft, image: dataUrl })
      }} /></label>
      <div className="image-preview">{draft.image ? <img src={draft.image} /> : <span>未上傳圖片</span>}</div>
      {(['red', 'blue', 'green'] as StatKey[]).map(k => <StatControl key={k} stat={k} value={draft.stats[k]} onChange={v => setStat(k, v)} onAdjust={d => setStat(k, draft.stats[k] + d)} />)}
      <h3>擁有技能</h3>
      <div className="skill-grid">
        {skills.map(skill => <button key={skill.id} className={draft.skills.includes(skill.id) ? 'skill selected' : 'skill'} onClick={() => toggleSkill(skill.id)}>
          <SkillIcon skillId={skill.id} />
          <span>{skill.name}</span>
        </button>)}
      </div>
      <div className="actions sticky-actions">
        <button className="primary" onClick={save}>儲存</button>
        <button onClick={onClose}>取消</button>
      </div>
    </div>
  </div>
}

function ResultPage({ route, onRun }: { route: Route; onRun: () => void }) {
  const state = useAppStore()
  const displayTeams = state.showAllTeams ? state.bestTeams : state.bestTeams.slice(0, 10)
  return <section className="panel result">
    <h2>最佳隊伍搜尋</h2>
    <button className="primary big" onClick={onRun}>🔍 計算最佳隊伍</button>
    <p>目前模式：{state.allowDuplicate ? '允許重複派遣' : '一般模式'}</p>
    {state.mushrooms.length === 0 && <div className="empty">尚未建立菇菇。請先到「菇菇」頁新增資料。</div>}
    {state.searched > 0 && <p>已搜尋 {state.searched} 組；最佳隊伍 {state.bestTeams.length} 組。</p>}
    {state.bestTeams.length > 10 && !state.showAllTeams && <button onClick={() => state.setShowAllTeams(true)}>顯示全部 {state.bestTeams.length} 組</button>}
    {displayTeams.map((team, idx) => <TeamResultCard key={idx} team={team} index={idx} route={route} />)}
  </section>
}

function TeamResultCard({ team, index, route }: { team: BestTeam; index: number; route: Route }) {
  const members = normalizeTeamMembers(team)
  return <div className="best-team">
    <h3>#{index + 1} 完成 {team.score} / {route.missions.length}</h3>
    <section className="team-member-section">
      <h4>隊伍成員</h4>
      {members.length === 0 ? <div className="empty small-empty">沒有隊伍成員資料。請確認已覆蓋到 V1.7.3 後重新計算。</div> : <>
        <p className="team-line">{teamSignature({ ...team, members } as any)}</p>
        <div className="team-members">
          {members.map((member, idx) => <TeamMemberCard key={`${member.key ?? member.mushroomId}-${idx}`} member={member} />)}
        </div>
      </>}
    </section>
    <div className="team-total">
      <strong>隊伍總值</strong>
      <StatBadge stat="red" value={team.total.red} />
      <StatBadge stat="blue" value={team.total.blue} />
      <StatBadge stat="green" value={team.total.green} />
    </div>
    <details>
      <summary>任務明細</summary>
      <div className="two-cols">
        <div><h4>完成</h4>{team.completed.map(c => <MissionCheckLine className="ok" key={c.mission.name} check={c} />)}</div>
        <div><h4>未完成</h4>{team.failed.map(c => <MissionCheckLine className="bad" key={c.mission.name} check={c} showReason />)}</div>
      </div>
    </details>
  </div>
}


function normalizeTeamMembers(team: any): TeamMember[] {
  const candidate = team?.members ?? team?.team ?? team?.mushrooms ?? team?.teamMembers ?? []
  if (Array.isArray(candidate)) return candidate.filter(Boolean)
  return []
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  return <div className="member-card">
    <div className="member-image">{member.image ? <img src={member.image} /> : <span>🍄</span>}</div>
    <div className="member-info">
      <strong>{member.name}</strong>
      <div className="stat-inline"><StatBadge stat="red" value={member.stats.red} /><StatBadge stat="blue" value={member.stats.blue} /><StatBadge stat="green" value={member.stats.green} /></div>
      <div className="icon-row">{member.skills.map(id => <SkillIcon key={id} skillId={id} />)}</div>
    </div>
  </div>
}

function MissionCheckLine({ check, className, showReason = false }: { check: any; className: string; showReason?: boolean }) {
  return <div className={`mission-check ${className}`}>
    <strong>{className === 'ok' ? '✓' : '✗'} {check.mission.name}</strong>
    <div className="requirement-lines">{check.mission.requirements.map((r: Requirement, idx: number) => <RequirementView key={idx} req={r} />)}</div>
    {showReason && <small>{check.reason}</small>}
  </div>
}

function SettingsPage() {
  const state = useAppStore()
  const [importText, setImportText] = useState('')
  const backup = useMemo(() => state.exportData(), [state.mushrooms, state.instances, state.allowDuplicate])
  return <section className="panel">
    <h2>設定與備份</h2>
    <label className="check-row"><input type="checkbox" checked={state.allowDuplicate} onChange={e => state.setAllowDuplicate(e.target.checked)} />允許重複派遣菇菇（同種最多 2 隻）</label>
    <h3>匯出資料</h3>
    <textarea readOnly value={backup} rows={8} />
    <button onClick={() => downloadText('nameko-backup.json', backup)}>下載備份 JSON</button>
    <h3>匯入資料</h3>
    <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8} placeholder="貼上 backup.json 內容" />
    <div className="actions">
      <button onClick={() => { try { state.importData(importText); setImportText('') } catch { alert('JSON 格式錯誤') } }}>匯入</button>
      <button className="danger" onClick={() => confirm('清空所有菇菇資料？') && state.clearAll()}>清空資料</button>
    </div>
  </section>
}

function RequirementView({ req }: { req: Requirement }) {
  if (req.type === 'single' || req.type === 'memberCount') {
    const count = req.type === 'single' ? (req.count ?? 1) : req.count
    return <span className="req-chip">需要 {count} 隻 <StatIcon stat={req.stat} /> {req.value}<BonusView req={req} /></span>
  }
  if (req.type === 'teamTotal') {
    return <span className="req-chip">隊伍合計 <StatIcon stat={req.stat} /> {req.value}<BonusView req={req} /></span>
  }
  if (req.type === 'multiStat') {
    const entries = Object.entries(req.requirements) as [StatKey, number][]
    return <span className="req-chip">同一隻 {entries.map(([stat, value]) => <React.Fragment key={stat}><StatIcon stat={stat} /> {value} </React.Fragment>)}<BonusView req={req} /></span>
  }
  if (req.type === 'hasSkill') {
    return <span className="req-chip">需要 <SkillPill skillId={req.skill} /></span>
  }
  if (req.type === 'hasSkills') {
    return <span className="req-chip">同一隻擁有 {req.skills.map(id => <SkillPill key={id} skillId={id} />)}</span>
  }
  return <span className="req-chip">未知條件</span>
}

function BonusView({ req }: { req: any }) {
  if (req.allHaveSkill) return <span className="bonus">（全員 <SkillPill skillId={req.allHaveSkill} /> <StatIcon stat={req.bonusStat} /> +{req.bonusValue ?? 0}）</span>
  if (req.bonusSkill) return <span className="bonus">（<SkillPill skillId={req.bonusSkill} /> <StatIcon stat={req.bonusStat} /> +{req.bonusValue ?? 0}）</span>
  return null
}

function SkillPill({ skillId }: { skillId: string }) {
  return <span className="skill-pill"><SkillIcon skillId={skillId} /><span>{getSkillName(skillId, skills)}</span></span>
}

function SkillIcon({ skillId }: { skillId: string }) {
  const skill = skills.find(s => s.id === skillId)
  if (!skill?.icon) return <span className="skill-fallback">{skill?.name?.slice(0, 1) ?? '?'}</span>
  return <img className="skill-icon" src={`${BASE}${skill.icon}`} alt={skill.name} />
}

function StatIcon({ stat }: { stat?: StatKey }) {
  if (!stat) return null
  return <img className="stat-icon" src={statIconPaths[stat]} alt={statLabels[stat]} title={statLabels[stat]} />
}

function StatBadge({ stat, value }: { stat: StatKey; value: number }) {
  return <span className="stat-badge"><StatIcon stat={stat} />{value}</span>
}

function StatControl({ stat, value, onChange, onAdjust }: { stat: StatKey; value: number; onChange: (v: number) => void; onAdjust: (d: number) => void }) {
  return <div className="stat-row">
    <span className="stat-label"><StatIcon stat={stat} /></span>
    <button onClick={() => onAdjust(-5)}>-5</button>
    <input type="number" value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
    <button onClick={() => onAdjust(5)}>+5</button>
  </div>
}

function newEmptyMushroom(): Mushroom {
  return {
    id: `custom_${Date.now()}`,
    name: '',
    image: '',
    stats: { red: 0, blue: 0, green: 0 },
    skills: []
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function downloadText(filename: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

createRoot(document.getElementById('root')!).render(<App />)
