#!/usr/bin/env node
// SessionStart 훅: 등록된 경로(way) 개수를 세션 컨텍스트로 간단히 알린다. (네트워크 호출 없음)
'use strict'
const fs = require('fs'), os = require('os'), path = require('path')
const p = process.env.TRANSIT_CONFIG || path.join(os.homedir(), '.transitway', 'config.json')
let cfg = {}
try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}
const ways = cfg.ways ? Object.keys(cfg.ways) : []
if (ways.length) {
  console.log(`[transitway] 등록된 경로 ${ways.length}개 (${ways.join(', ')}). "/transitway"로 경로별 소요시간을 계산해 카카오톡 전송.`)
} else {
  console.log('[transitway] 등록된 경로 없음. transit MCP의 set_way로 경로를 저장한 뒤 "/transitway" 사용.')
}
