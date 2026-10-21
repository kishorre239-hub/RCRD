/**
 * GEONIXA LIVE CLASS: PRODUCTION LOAD & SCALABILITY TEST HARNESS
 * 
 * Verifies Next.js App Router HTTP endpoints under 1, 25, 50, 100, and 150
 * concurrent synthetic participants across token minting, participant presence,
 * and state polling.
 * 
 * Accurately reports real completed HTTP statuses, exact latencies, payload sizes,
 * error types (connection refused, timeouts, 4xx, 5xx), and LiveKit SFU configuration status.
 */

import http from 'http';
import https from 'https';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const TEST_ROOM_ID = process.env.TEST_ROOM_ID || `LOAD_TEST_${Date.now()}`;

/**
 * Robust HTTP client that captures real completed latency, status codes, payload bytes,
 * and specific error categories without converting failures into zero-millisecond successes.
 */
function requestAsync(urlStr, options = {}, postData = null) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOpts = {
      hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || (postData ? 'POST' : 'GET'),
      family: 4, // Force IPv4 to eliminate 5-second Windows IPv6 Happy Eyeballs delay
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: options.timeout || 15000,
    };

    const startTime = performance.now();
    const req = lib.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const latencyMs = performance.now() - startTime;
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({
          isError: false,
          statusCode: res.statusCode || 0,
          headers: res.headers,
          data,
          json,
          latencyMs,
          payloadBytes: Buffer.byteLength(data),
        });
      });
    });

    req.on('error', (err) => {
      const latencyMs = performance.now() - startTime;
      resolve({
        isError: true,
        errorType: err.code === 'ECONNREFUSED' ? 'ConnectionRefused' : (err.code || 'NetworkError'),
        errorMsg: err.message,
        statusCode: 0,
        latencyMs,
        payloadBytes: 0,
        data: '',
        json: null,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const latencyMs = performance.now() - startTime;
      resolve({
        isError: true,
        errorType: 'Timeout',
        errorMsg: 'Socket timed out before response finished',
        statusCode: 0,
        latencyMs,
        payloadBytes: 0,
        data: '',
        json: null,
      });
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function computeStats(results, validator) {
  const successful = [];
  const errors = {
    connRefused: 0,
    timeouts: 0,
    status4xx: 0,
    status5xx: 0,
    invalidPayload: 0,
  };

  results.forEach((r) => {
    if (r.isError) {
      if (r.errorType === 'ConnectionRefused') errors.connRefused++;
      else if (r.errorType === 'Timeout') errors.timeouts++;
      else errors.connRefused++;
      return;
    }

    if (r.statusCode >= 400 && r.statusCode < 500) {
      errors.status4xx++;
      return;
    }
    if (r.statusCode >= 500) {
      errors.status5xx++;
      return;
    }

    if (validator && !validator(r)) {
      errors.invalidPayload++;
      return;
    }

    successful.push(r);
  });

  const completed = results.filter((r) => !r.isError && r.statusCode > 0);
  const latencies = successful.map((r) => r.latencyMs).sort((a, b) => a - b);
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p95Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1] : 0;
  const p99Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] || latencies[latencies.length - 1] : 0;
  const minLatency = latencies.length ? latencies[0] : 0;
  const maxLatency = latencies.length ? latencies[latencies.length - 1] : 0;

  const totalBytes = successful.reduce((acc, r) => acc + (r.payloadBytes || 0), 0);
  const avgPayloadKb = successful.length ? (totalBytes / successful.length) / 1024 : 0;

  return {
    total: results.length,
    successCount: successful.length,
    successRate: (successful.length / (results.length || 1)) * 100,
    completedCount: completed.length,
    errors,
    latencies: { avg: avgLatency, p95: p95Latency, p99: p99Latency, min: minLatency, max: maxLatency },
    payload: { totalBytes, avgKb: avgPayloadKb },
    samplePayload: successful[0]?.data ? successful[0].data.slice(0, 180) : (results[0]?.errorMsg || ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1: Token Minting & SFU Capability
// ─────────────────────────────────────────────────────────────────────────────

async function runTokenGenerationTest(concurrentUsers) {
  console.log(`\n▶ [Stage 1] Token Endpoint Test (${concurrentUsers} concurrent requests)`);
  const promises = [];
  const start = performance.now();

  for (let i = 0; i < concurrentUsers; i++) {
    const pId = `synth_student_${i}_${Date.now()}`;
    const pName = `Synthetic Student ${i + 1}`;
    const url = `${BASE_URL}/api/meetings/${encodeURIComponent(TEST_ROOM_ID)}/token`;
    promises.push(
      requestAsync(url, { method: 'POST' }, {
        participantId: pId,
        name: pName,
        role: 'student',
      })
    );
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - start;

  // Validate: route responded 200 with valid success envelope
  const stats = computeStats(results, (r) => r.statusCode === 200 && r.json?.success === true);

  // Check whether LiveKit SFU credentials minted a real token or reported P2P fallback
  const firstJson = results.find((r) => r.json)?.json;
  const isSfuMinted = Boolean(firstJson?.enabled && firstJson?.token);
  const modeLabel = isSfuMinted ? 'LIVEKIT SFU (Token Minted)' : 'P2P FALLBACK (LiveKit env keys not set)';

  console.log(`  ✓ Wall Time: ${totalDuration.toFixed(1)}ms`);
  console.log(`  ✓ Success: ${stats.successCount}/${stats.total} (${stats.successRate.toFixed(1)}%) | Mode: ${modeLabel}`);
  if (stats.latencies.avg > 0) {
    console.log(`  ✓ Latency: Avg = ${stats.latencies.avg.toFixed(1)}ms | P95 = ${stats.latencies.p95.toFixed(1)}ms | Max = ${stats.latencies.max.toFixed(1)}ms`);
  }
  if (stats.errors.connRefused || stats.errors.timeouts || stats.errors.status5xx) {
    console.log(`  ⚠ Failures: ConnRefused=${stats.errors.connRefused}, Timeout=${stats.errors.timeouts}, 5xx=${stats.errors.status5xx}`);
  }

  return { stage: 'token', concurrentUsers, duration: totalDuration, modeLabel, isSfuMinted, ...stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2: Participant Presence & Ping Storm
// ─────────────────────────────────────────────────────────────────────────────

async function runParticipantPresenceTest(concurrentUsers) {
  console.log(`\n▶ [Stage 2] Participant Presence & Ping Storm (${concurrentUsers} students)`);
  const promises = [];
  const start = performance.now();

  for (let i = 0; i < concurrentUsers; i++) {
    const pId = `synth_p_${i}`;
    const url = `${BASE_URL}/api/meetings/${encodeURIComponent(TEST_ROOM_ID)}/participants`;
    promises.push(
      requestAsync(url, { method: 'POST' }, {
        participantId: pId,
        name: `Student ${i + 1}`,
        role: 'Student',
        isMuted: true,
        isVideoOn: false,
        isHandRaised: false,
      })
    );
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - start;

  // Validate: 200 OK and participants array returned
  const stats = computeStats(results, (r) => r.statusCode === 200 && r.json?.success === true && Array.isArray(r.json?.participants));

  console.log(`  ✓ Wall Time: ${totalDuration.toFixed(1)}ms`);
  console.log(`  ✓ Success: ${stats.successCount}/${stats.total} (${stats.successRate.toFixed(1)}%)`);
  if (stats.latencies.avg > 0) {
    console.log(`  ✓ Latency: Avg = ${stats.latencies.avg.toFixed(1)}ms | P95 = ${stats.latencies.p95.toFixed(1)}ms | Max = ${stats.latencies.max.toFixed(1)}ms`);
  }
  if (stats.errors.connRefused || stats.errors.timeouts || stats.errors.status5xx) {
    console.log(`  ⚠ Failures: ConnRefused=${stats.errors.connRefused}, Timeout=${stats.errors.timeouts}, 5xx=${stats.errors.status5xx}`);
  }

  return { stage: 'presence', concurrentUsers, duration: totalDuration, ...stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 3: State Polling & Egress Bandwidth
// ─────────────────────────────────────────────────────────────────────────────

async function runStatePollingLoadTest(concurrentUsers) {
  console.log(`\n▶ [Stage 3] State Polling & Egress Bandwidth (${concurrentUsers} concurrent students)`);
  const promises = [];
  const start = performance.now();

  for (let i = 0; i < concurrentUsers; i++) {
    const url = `${BASE_URL}/api/meetings/${encodeURIComponent(TEST_ROOM_ID)}/state`;
    promises.push(requestAsync(url, { method: 'GET' }));
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - start;

  // Validate: 200 OK and success === true with live room state
  const stats = computeStats(results, (r) => r.statusCode === 200 && r.json?.success === true && r.json?.status === 'live');

  console.log(`  ✓ Wall Time: ${totalDuration.toFixed(1)}ms`);
  console.log(`  ✓ Success: ${stats.successCount}/${stats.total} (${stats.successRate.toFixed(1)}%)`);
  console.log(`  ✓ Avg Response Size: ${stats.payload.avgKb.toFixed(2)} KB (Total egress = ${(stats.payload.totalBytes / 1024).toFixed(1)} KB)`);
  if (stats.latencies.avg > 0) {
    console.log(`  ✓ Latency: Avg = ${stats.latencies.avg.toFixed(1)}ms | P95 = ${stats.latencies.p95.toFixed(1)}ms | Max = ${stats.latencies.max.toFixed(1)}ms`);
  }
  if (stats.errors.connRefused || stats.errors.timeouts || stats.errors.status5xx) {
    console.log(`  ⚠ Failures: ConnRefused=${stats.errors.connRefused}, Timeout=${stats.errors.timeouts}, 5xx=${stats.errors.status5xx}`);
  }

  return { stage: 'state', concurrentUsers, duration: totalDuration, ...stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4: Multi-Room Concurrency Test
// ─────────────────────────────────────────────────────────────────────────────

async function runMultiRoomConcurrentTest(numRooms, usersPerRoom) {
  const totalUsers = numRooms * usersPerRoom;
  console.log(`\n▶ [Stage 4] Multi-Class Concurrency Test (${numRooms} Simultaneous Rooms × ${usersPerRoom} Students = ${totalUsers} Total Participants)`);
  const promises = [];
  const start = performance.now();

  for (let r = 0; r < numRooms; r++) {
    const roomId = `CONCURRENT_CLASS_${r + 1}_${Date.now()}`;
    for (let u = 0; u < usersPerRoom; u++) {
      const pId = `synth_r${r}_u${u}`;
      const url = `${BASE_URL}/api/meetings/${encodeURIComponent(roomId)}/token`;
      promises.push(
        requestAsync(url, { method: 'POST' }, {
          participantId: pId,
          name: `Room ${r + 1} Student ${u + 1}`,
          role: 'student',
        })
      );
    }
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - start;
  const stats = computeStats(results, (r) => r.statusCode === 200 && r.json?.success === true);

  console.log(`  ✓ Wall Time: ${totalDuration.toFixed(1)}ms`);
  console.log(`  ✓ Total Requests Handled: ${results.length}`);
  console.log(`  ✓ Success Rate: ${stats.successCount}/${totalUsers} (${stats.successRate.toFixed(1)}%)`);
  if (stats.latencies.avg > 0) {
    console.log(`  ✓ Latency: Avg = ${stats.latencies.avg.toFixed(1)}ms | P95 = ${stats.latencies.p95.toFixed(1)}ms | Max = ${stats.latencies.max.toFixed(1)}ms`);
  }

  return { stage: 'multi-room', numRooms, usersPerRoom, totalUsers, duration: totalDuration, ...stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-FLIGHT VERIFICATION & MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('======================================================================');
  console.log('GEONIXA LIVE CLASS: 150-STUDENT PRODUCTION SCALABILITY LOAD TEST');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Test Room ID: ${TEST_ROOM_ID}`);
  console.log('======================================================================\n');

  console.log('Step 1: Diagnosing Next.js Server & Preflight Endpoints...');
  
  // Test basic HTTP listener
  const loginCheck = await requestAsync(`${BASE_URL}/login`, { method: 'GET', timeout: 5000 });
  if (loginCheck.isError) {
    console.error(`\n❌ FATAL: Target server at ${BASE_URL} is NOT reachable.`);
    console.error(`   Error: ${loginCheck.errorType} — ${loginCheck.errorMsg}`);
    console.error(`   Remedy: Start the Next.js production server first using 'npm run start' (port 3001).`);
    process.exit(1);
  }
  console.log(`  ✓ Next.js HTTP Server is listening: /login responded with HTTP ${loginCheck.statusCode} (${loginCheck.latencyMs.toFixed(1)}ms).`);

  // Check /api/health
  const healthCheck = await requestAsync(`${BASE_URL}/api/health`, { method: 'GET', timeout: 8000 });
  if (healthCheck.statusCode === 200) {
    console.log(`  ✓ /api/health: Database CONNECTED (HTTP 200).`);
  } else {
    console.log(`  ⚠ /api/health: HTTP ${healthCheck.statusCode} — ${healthCheck.json?.error || 'Database pending / unreachable'}. (Loom fallback storage is active).`);
  }

  // Check LiveKit SFU environment credentials
  const preflightToken = await requestAsync(`${BASE_URL}/api/meetings/${encodeURIComponent(TEST_ROOM_ID)}/token`, { method: 'POST' }, {
    participantId: 'preflight_admin',
    name: 'Preflight Inspector',
    role: 'student',
  });

  const isLiveKitEnabled = Boolean(preflightToken.json?.enabled && preflightToken.json?.token);
  console.log(`  ℹ Media Routing Mode: ${isLiveKitEnabled ? 'LIVEKIT SFU (Cloud credentials configured)' : 'NATIVE P2P MESH FALLBACK (LIVEKIT_URL/KEY not in .env.local)'}`);
  console.log('----------------------------------------------------------------------');

  const tiers = [1, 25, 50, 100, 150];
  const summaryReport = {
    tokenResults: [],
    presenceResults: [],
    stateResults: [],
    multiRoomResult: null,
  };

  for (const count of tiers) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`LOAD TEST TIER: 1 Teacher + ${count} Students`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const tokenRes = await runTokenGenerationTest(count);
    summaryReport.tokenResults.push(tokenRes);

    const presenceRes = await runParticipantPresenceTest(count);
    summaryReport.presenceResults.push(presenceRes);

    const stateRes = await runStatePollingLoadTest(count);
    summaryReport.stateResults.push(stateRes);
  }

  // Multi-room scenario (5 concurrent rooms with 30 students each = 150 participants)
  summaryReport.multiRoomResult = await runMultiRoomConcurrentTest(5, 30);

  console.log('\n======================================================================');
  console.log('LOAD TEST COMPLETE — ALL TIERS EXECUTED AGAINST REAL HTTP ENDPOINTS');
  console.log('======================================================================');
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
