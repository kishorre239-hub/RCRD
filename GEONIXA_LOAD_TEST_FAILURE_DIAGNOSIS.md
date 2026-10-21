# Geonixa Load Test Failure Diagnosis & Resolution Report

**Execution Timestamp:** 2026-10-21T12:51:30+05:30  
**Target Environment:** Local Production Build (`next start -p 3001`)  
**Base URL:** `http://127.0.0.1:3001`  
**Platform:** Windows 11 / Node.js v20+ / Next.js 16.3.4 App Router  

---

## 1. Exact Reason the Original Requests Failed (0/150 Failure Audit)

When the user executed `scripts/load-test.mjs`, all tiers reported **0% success**, zero measured latency (`0.0ms`), and zero payload size (`0.00 KB`), with the error message:

> *"Target server at `http://localhost:3001` is not reachable directly. Testing against local internal Next.js handlers..."*

Our investigation identified **three distinct root causes** in the server and test harness:

### Root Cause 1: Windows IPv6 "Happy Eyeballs" DNS Fallback Delay (5,600ms)

* In Node.js on Windows 11, `http.request({ hostname: 'localhost' })` first queries the IPv6 loopback address (`::1`).
* Windows TCP stack pauses for **5,000 ms** waiting on IPv6 socket handshake before attempting IPv4 (`127.0.0.1`).
* Direct timing benchmark performed during diagnosis:
  * `http.get('http://127.0.0.1:3001/login')` $\rightarrow$ **98 ms** (HTTP 200)
  * `http.get('http://localhost:3001/login')` $\rightarrow$ **5,641 ms** (HTTP 200)
* Because the original test harness had a hardcoded `timeout: 3000ms`, every single request to `localhost:3001` was killed by socket timeout before the IPv4 fallback could connect.

### Root Cause 2: Health Check Timeout Induced Premature Abort

* The pre-flight check targeted `/api/health` with `timeout: 3000ms`.
* `/api/health` performs `db.command({ ping: 1 })` to MongoDB Atlas with a **5,000 ms** connection timeout.
* When MongoDB Atlas took 5,000 ms to respond, the 3,000 ms test harness timeout destroyed the socket at 3,000 ms.
* The original script caught the timeout and printed the misleading message: *"Target server at `http://localhost:3001` is not reachable directly. Testing against local internal Next.js handlers..."*.
* The script did **not** test internal handlers; it continued issuing `http.request` calls that all failed.

### Root Cause 3: Silent Exception Swallowing in Test Harness

* In the original `scripts/load-test.mjs`, every network request was wrapped with:

  ```javascript
  .catch(err => ({ statusCode: 500, error: err, latencyMs: 0 }))
  ```

* When requests threw `ECONNREFUSED` or `Timeout`, the catch block converted them into synthetic `{ statusCode: 500, latencyMs: 0 }`.
* Then `filter(r => r.statusCode === 200)` produced `0/150 (0.0%)`, and `latencies = [0, 0, ...]` produced `Avg = 0.0ms | P95 = 0.0ms`.
* No error details, status codes, or failure reasons were surfaced.

---

## 2. Files and Scripts Changed

| File | Change Description |
| :--- | :--- |
| `scripts/load-test.mjs` | **Completely rewritten.** Replaced `localhost` with `127.0.0.1` and added `family: 4` to bypass the 5-second Windows IPv6 DNS pause. Implemented real exception accounting (`ConnectionRefused`, `Timeout`, `4xx`, `5xx`). Added payload validation so requests only count as successful when the endpoint returns valid JSON envelopes (`json.success === true`). Eliminated fake `0ms` metrics. |
| `src/app/api/meetings/[id]/state/route.ts` | Added `'request-screen'` to `WebRTCSignal['type']` union for TypeScript schema validation. |
| `src/app/meetings/room/[roomId]/page.tsx` | Added direct receiver video track binding in `handleWebRTCSignal` and `useEffect` auto-sync to eliminate student screen share lag. Ensured `contentHint = 'detail'` on recording tracks. |
| `src/hooks/useRecorder.ts` | Added `contentHint = 'detail'` to video tracks before `MediaRecorder` instantiation to preserve 1080p spatial resolution at 16 kbps. |
| `src/components/RecordingSetupModal.tsx` | Added `contentHint = 'detail'` to video tracks before `MediaRecorder` instantiation. |

---

## 3. Real HTTP Statuses and Error Details

Pre-flight and endpoint responses captured directly from `node.exe` running on port 3001:

| Endpoint | HTTP Status | Actual Response Body / Error Detail |
| :--- | :--- | :--- |
| `GET /login` | **200 OK** | Serves static login page (18,317 bytes) in **23.1 ms**. |
| `GET /api/health` | **200 OK** / **503** | When Atlas connects: `{"status":"UP","database":"CONNECTED"}` (200). When Atlas socket times out: `{"status":"DOWN","database":"DISCONNECTED","error":"Socket 'secureConnect' timed out after 5015ms"}` (503). |
| `POST /api/meetings/[id]/token` | **200 OK** | `{"success":true,"enabled":false,"message":"LiveKit SFU credentials not configured in environment. Using standard WebRTC mode."}` |
| `POST /api/meetings/[id]/participants` | **200 OK** | `{"success":true,"participants":[{"id":"p1","name":"Student 1",...}]}` in **6.0 ms**. |
| `GET /api/meetings/[id]/state` | **200 OK** | `{"success":true,"status":"live","hostCamera":{...},"screenShare":{...}}` (580 bytes) in **4.9 ms**. |

---

## 4. Actual Rerun Results (Executed via `npm run test:load`)

All requests were executed against the live Next.js production server (`http://127.0.0.1:3001`). Zero simulated or internal handlers were used.

### 4.1 Single Classroom Scalability Tiers (1 to 150 Students)

| Student Cohort | Stage 1: Token Endpoint (Avg / P95 / Max) | Stage 2: Presence Ping (Avg / P95 / Max) | Stage 3: State Polling (Avg / P95 / Max) | Avg Response Size | Real Success Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1 Student** | 6.4 ms / 6.4 ms / 6.4 ms | 6.0 ms / 6.0 ms / 6.0 ms | 4.9 ms / 4.9 ms / 4.9 ms | **0.58 KB** | **100.0%** (1/1) |
| **25 Students** | 97.2 ms / 146.6 ms / 149.6 ms | 50.9 ms / 94.4 ms / 97.6 ms | 42.6 ms / 76.1 ms / 78.8 ms | **0.58 KB** | **100.0%** (25/25) |
| **50 Students** | 106.6 ms / 191.5 ms / 200.4 ms | 108.0 ms / 197.7 ms / 206.7 ms | 112.9 ms / 186.4 ms / 192.9 ms | **0.58 KB** | **100.0%** (50/50) |
| **100 Students** | 205.2 ms / 386.1 ms / 401.9 ms | 218.0 ms / 399.3 ms / 412.3 ms | 183.3 ms / 351.9 ms / 365.1 ms | **0.58 KB** | **100.0%** (100/100) |
| **150 Students** | **248.4 ms / 443.1 ms / 468.5 ms** | **264.8 ms / 496.3 ms / 523.4 ms** | **199.5 ms / 376.9 ms / 395.0 ms** | **0.58 KB** | **100.0%** (150/150) |

### 4.2 Multi-Room Concurrency Test (Stage 4)

* **Configuration:** 5 Simultaneous Live Classrooms × 30 Students = **150 Total Concurrent Participants**
* **Total HTTP Requests Handled:** 150 parallel requests
* **Wall Clock Duration:** **635.6 ms**
* **Success Rate:** **150/150 (100.0%)**
* **Average Latency:** **337.8 ms**
* **P95 Latency:** **600.1 ms**
* **Max Latency:** **628.4 ms**
* **Failure Count:** 0 connection refused, 0 timeouts, 0 4xx, 0 5xx.

---

## 5. Media Infrastructure & LiveKit SFU Status

### Is LiveKit Configured in Environment?

* **Audit of `.env.local`:**
  * `LIVEKIT_URL`: **MISSING**
  * `NEXT_PUBLIC_LIVEKIT_URL`: **MISSING**
  * `LIVEKIT_API_KEY`: **MISSING**
  * `LIVEKIT_API_SECRET`: **MISSING**
* **Current Operational Mode:** **NATIVE P2P MESH FALLBACK MODE**
  * Because the credentials are not set in `.env.local`, the server-side token endpoint returns:

    ```json
    { "success": true, "enabled": false, "message": "LiveKit SFU credentials not configured in environment. Using standard WebRTC mode." }
    ```

  * Client code in `src/hooks/useLiveKitSFU.ts` receives `enabled: false` and sets `isSFUActive = false`, falling back to peer-to-peer WebRTC mesh.

### Has 150-Person Live Media Capacity Been Genuinely Tested?

* **HTTP / Signaling Tier:** **YES.** The Next.js App Router, token endpoint, participant presence, and state polling have been genuinely tested up to 150 concurrent real HTTP connections with sub-second response times (P95 < 500 ms).
* **Live Video Streaming Tier:** **NO.** 150 real browser media connections publishing and subscribing to live video **have not and cannot be tested under P2P mesh mode**.
  * In P2P mode, 150 students connecting to 1 teacher would require the teacher's browser to encode and upload 150 separate 1080p video streams simultaneously ($150 \times 2.5\text{ Mbps} = 375\text{ Mbps}$ outbound bandwidth), which immediately exhausts host CPU and upload bandwidth.
  * LiveKit SFU is strictly required to achieve real 150-student video broadcast (1 teacher uploads 1 stream to the SFU, and the SFU distributes it to 150 subscribers).

---

## 6. Remaining Issues & Exact Next Steps

1. **Provide LiveKit Credentials in `.env.local`:**
   To enable genuine SFU video distribution for 150 students, add the following to `.env.local`:

   ```env
   LIVEKIT_URL=wss://your-project.livekit.cloud
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_livekit_api_key
   LIVEKIT_API_SECRET=your_livekit_api_secret
   ```

2. **MongoDB Atlas DNS / SRV Resolution:**
   The connection string `cluster0.lsj9dut.mongodb.net` intermittently experiences `querySrv ECONNREFUSED` or timeout when local Windows DNS servers fail to resolve MongoDB SRV records. If running locally without Atlas network access, Loom's local backup store (`.data/meetings.json` and `.data/meeting-room-states.json`) successfully keeps all rooms active.
3. **Automated Server Lifecycle in CI/CD:**
   When running `npm run test:load` in automated test environments, ensure `npm run start` is started first as a service or background job so port 3001 is listening before the test harness begins.
