#!/usr/bin/env node
// transitway MCP 서버 (무의존성).
// 사용자가 직접 정의한 여러 경로(way = 경유지 순서)별 대중교통 소요시간을 계산한다.
//  - 지오코딩: 카카오 로컬 REST (KAKAO_REST_API_KEY)  이름 → 좌표
//  - 구간 소요시간: ODsay 대중교통 API (ODSAY_API_KEY, ODSAY_REFERER)  좌표쌍 → 분
// 프로토콜: MCP stdio (줄단위 JSON-RPC 2.0). stdout=응답 전용, 로그는 stderr.
'use strict'

const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ---- 설정 파일 ----
const CONFIG_PATH = process.env.TRANSIT_CONFIG ||
  path.join(os.homedir(), '.transitway', 'config.json')

function readConfig() {
  try { const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); c.ways = c.ways || {}; c.geocache = c.geocache || {}; return c }
  catch { return { ways: {}, geocache: {} } }
}
function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8')
}

// ---- HTTPS GET (JSON), 헤더 지정 가능 ----
function getJSON(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: headers || {} }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch { reject(new Error('bad JSON: ' + body.slice(0, 150))) }
      })
    }).on('error', reject)
  })
}

// ---- 지오코딩: 이름 → [경도, 위도] (카카오 로컬 키워드 검색) ----
async function geocode(name, cfg) {
  const key = name.trim()
  if (cfg.geocache[key]) return cfg.geocache[key]
  const rest = process.env.KAKAO_REST_API_KEY
  if (!rest || rest.startsWith('$')) throw new Error('KAKAO_REST_API_KEY 미설정 (지오코딩 불가)')
  const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(key)
  const data = await getJSON(url, { Authorization: 'KakaoAK ' + rest })
  const doc = data.documents && data.documents[0]
  if (!doc) throw new Error('좌표 못 찾음: ' + key)
  const coord = [Number(doc.x), Number(doc.y)] // x=경도, y=위도
  cfg.geocache[key] = coord
  return coord
}

// ---- 구간 소요시간(분): 좌표쌍 → ODsay 최단 경로 시간 ----
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ---- 두 좌표 사이 도보 시간(분) 근사 ----
// ODsay가 경로를 못 주는(너무 가까운) 순수 도보 구간 계산용.
function haversine(x1, y1, x2, y2) { // 경도,위도(도) → m
  const R = 6371000, toRad = d => d * Math.PI / 180
  const dLat = toRad(y2 - y1), dLon = toRad(x2 - x1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(y1)) * Math.cos(toRad(y2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function walkMinutes(x1, y1, x2, y2) {
  const m = haversine(x1, y1, x2, y2) * 1.3   // 직선거리 × 우회계수
  return Math.max(1, Math.round(m / 75))       // 75 m/min ≈ 4.5 km/h
}

async function legTime(sx, sy, ex, ey) {
  const key = process.env.ODSAY_API_KEY
  if (!key || key.startsWith('$')) throw new Error('ODSAY_API_KEY 미설정')
  const url = 'https://api.odsay.com/v1/api/searchPubTransPathT' +
    `?SX=${sx}&SY=${sy}&EX=${ex}&EY=${ey}&apiKey=${encodeURIComponent(key)}`
  const headers = { Referer: process.env.ODSAY_REFERER || 'http://localhost:5173' }

  // 다량 호출 시 간헐적 ODsay 오류가 나므로 최대 3회 재시도. 키/거리 오류는 즉시 처리.
  let data
  for (let attempt = 1; ; attempt++) {
    try { data = await getJSON(url, headers) }
    catch (e) { if (attempt >= 3) throw e; await sleep(400 * attempt); continue }
    if (data.error) {
      const msg = (data.error[0] && data.error[0].message) || JSON.stringify(data.error)
      if (/가까|근접|700/.test(msg)) return walkMinutes(sx, sy, ex, ey) // 너무 가까움 → 도보 계산
      if (/ApiKey|인증|Referer/i.test(msg)) throw new Error('ODsay: ' + msg) // 비재시도
      if (attempt >= 3) throw new Error('ODsay: ' + msg)
      await sleep(400 * attempt); continue                    // 그 외(일시 오류) 재시도
    }
    break
  }
  const paths = (data.result && data.result.path) || []
  if (!paths.length) return walkMinutes(sx, sy, ex, ey)
  // ODsay totalTime은 차내+환승 시간이고 '버스/열차 대기시간'은 빠져 있다.
  // 탑승 구간(버스=2, 지하철=1)의 배차간격(intervalTime)의 절반을 예상 대기로 더한다.
  // (균등 도착 가정: 평균 대기 = 배차/2). 광역버스처럼 배차 긴 노선을 제대로 반영.
  const adjusted = paths.map(p => {
    let wait = 0
    for (const s of (p.subPath || [])) {
      if ((s.trafficType === 1 || s.trafficType === 2) && s.intervalTime) wait += s.intervalTime / 2
    }
    return p.info.totalTime + wait
  })
  return Math.round(Math.min(...adjusted))
}

// ---- way 하나의 총 소요시간(분) 계산 ----
async function wayTotal(stops, cfg) {
  const coords = []
  for (const s of stops) coords.push(await geocode(s, cfg))
  let total = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const [sx, sy] = coords[i], [ex, ey] = coords[i + 1]
    total += await legTime(sx, sy, ex, ey)
  }
  return total
}

// ---- 경로 문자열 파싱: "A -> B -> C" / "A → B → C" → [A,B,C] ----
function parsePath(str) {
  return String(str).split(/->|→|,/).map(s => s.trim()).filter(Boolean)
}

// ---- 전체 way 브리핑 텍스트 (사용자 지정 형식, 200자 지향) ----
async function briefWays() {
  const cfg = readConfig()
  const ids = Object.keys(cfg.ways).sort()
  if (!ids.length) return 'way 미등록. set_way로 경로를 저장하세요.'

  const results = []
  for (const id of ids) {
    try {
      const t = await wayTotal(cfg.ways[id], cfg)
      results.push({ id, time: t, stops: cfg.ways[id] })
    } catch (e) {
      results.push({ id, time: null, stops: cfg.ways[id], err: e.message })
    }
  }
  writeConfig(cfg) // 지오코딩 캐시 저장

  const ok = results.filter(r => r.time != null)
  const best = ok.length ? ok.reduce((a, b) => a.time <= b.time ? a : b) : null
  const d = new Date()
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const lines = ['[오늘의 경로 추천]', '']
  if (best) {
    lines.push(`추천: ${best.id} / ${best.time}분`, '')
    lines.push(`경로 상세: ${best.stops.map(s => s.replace(/\s+/g, '')).join('→')}`, '')
  }
  lines.push('다른 경로:')
  lines.push(results.map(r => `${r.id} ${r.time != null ? r.time + '분' : '확인불가'}`).join(' / '))
  return lines.join('\n')
}

// ================= MCP 도구 정의 =================
const TOOLS = [
  {
    name: 'set_way',
    description: '이름 붙인 경로(way)를 저장한다. path는 경유지를 순서대로 "A -> B -> C" 형태로. 예) set_way(id="way1", path="출발지 -> 환승역 -> 도착지")',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '경로 이름 (예: way1)' },
        path: { type: 'string', description: '경유지 순서. "A -> B -> C" 또는 "A → B → C"' }
      },
      required: ['id', 'path']
    }
  },
  { name: 'get_ways', description: '저장된 모든 경로(way)를 반환한다.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'clear_ways',
    description: '저장된 경로를 지운다. id를 주면 해당 way만, 없으면 전체 삭제.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } }
  },
  {
    name: 'brief_ways',
    description: '등록된 모든 경로(way)의 대중교통 소요시간을 계산해 추천 경로 + 경로별 시간을 200자 이내 카톡용 텍스트로 만든다.',
    inputSchema: { type: 'object', properties: {} }
  }
]

async function callTool(name, args) {
  args = args || {}
  const cfg = readConfig()
  if (name === 'set_way') {
    cfg.ways[args.id] = parsePath(args.path)
    writeConfig(cfg)
    return `${args.id} 저장됨: ${cfg.ways[args.id].join(' → ')}`
  }
  if (name === 'get_ways') return JSON.stringify(cfg.ways, null, 2)
  if (name === 'clear_ways') {
    if (args.id) { delete cfg.ways[args.id]; writeConfig(cfg); return `${args.id} 삭제됨` }
    cfg.ways = {}; writeConfig(cfg); return '전체 경로 삭제됨'
  }
  if (name === 'brief_ways') return await briefWays()
  throw new Error('unknown tool: ' + name)
}

// ================= CLI 모드 (스케줄러용) =================
if (process.argv[2] === 'daily-brief') {
  briefWays()
    .then(t => { process.stdout.write(t); process.exit(0) })
    .catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
  return
}

// ================= JSON-RPC stdio 루프 =================
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n') }

async function handle(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: (params && params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'transitway', version: '2.0.0' }
      }
    })
    return
  }
  if (method === 'notifications/initialized' || method === 'initialized') return
  if (method === 'tools/list') { send({ jsonrpc: '2.0', id, result: { tools: TOOLS } }); return }
  if (method === 'tools/call') {
    try {
      const text = await callTool(params.name, params.arguments)
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(text) }] } })
    } catch (e) {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'ERROR: ' + e.message }], isError: true } })
    }
    return
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found: ' + method } })
}

let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  buf += chunk
  let nl
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    let msg
    try { msg = JSON.parse(line) } catch { continue }
    handle(msg)
  }
})
process.stderr.write('transitway MCP server (ways) started\n')
