# LectureBridge v0.1

Voice-first English-to-Spanish classroom translation proof of concept. A teacher streams microphone audio to a Node server; Google Cloud Speech-to-Text produces English, Translation produces Spanish, and Text-to-Speech generates one shared Spanish audio segment that every student hears through an ordered browser queue. Captions remain available as a supporting accessibility feature.

## Google Cloud setup (manual)

1. Create or select a Google Cloud project with billing enabled.
2. Enable **Cloud Speech-to-Text API**, **Cloud Translation API**, and **Cloud Text-to-Speech API** in project `triple-team-340600`.
3. For local development, install the Google Cloud CLI and run `gcloud auth application-default login` (recommended), or point `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON stored outside this repository.
4. Copy `.env.example` to `.env`, set `GOOGLE_CLOUD_PROJECT=triple-team-340600`, and set `GOOGLE_CLOUD_LOCATION=global`. `GOOGLE_TTS_VOICE` is optional.
5. Grant the runtime identity only the Speech-to-Text user and Cloud Translation user permissions it needs. Never put credentials in client code.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:5173/teacher` on the teacher computer and `http://<teacher-LAN-IP>:5173/student` on the student computer. Browser microphone capture requires a secure context: `localhost` works on the teacher machine, but a LAN-address teacher page generally needs HTTPS. For a true two-computer test, use an HTTPS development proxy/tunnel or serve a built deployment over HTTPS.

Production-style local run:

```powershell
npm run build
npm start
```

The server listens on port 8080 unless `PORT` is set. No deployment is performed by this project.

## Render deployment preparation

`render.yaml` defines one Node web service that builds the Vite frontend, serves `dist` from Express, accepts Socket.IO on the same HTTPS origin, binds to Render's assigned `PORT` on `0.0.0.0`, and checks `/api/health`. Automatic deploys are disabled so a Git push does not publish without an intentional Render action.

Before the first deployment:

1. Put this project in a private Git repository that Render can access. This local folder currently has no `.git` directory; repository creation and commits are intentionally not performed here.
2. In Google Cloud project `triple-team-340600`, create a dedicated service account with only the permissions needed to recognize speech, translate text, and synthesize speech. `roles/speech.client` and `roles/cloudtranslate.user` are the relevant narrow predefined roles for the first two APIs; avoid Owner or Editor.
3. In Render, create the Blueprint from `render.yaml`. Keep **Auto Deploy** off.
4. Set `GOOGLE_CLOUD_PROJECT` to `triple-team-340600` and set a strong, private `TEACHER_ACCESS_CODE`. Students never need this code; it only protects creation of billable teacher sessions.
5. Under the Render service's **Environment → Secret Files**, create `google-service-account.json` containing the service-account JSON. Render mounts it at `/etc/secrets/google-service-account.json`, which matches `GOOGLE_APPLICATION_CREDENTIALS` in the Blueprint. Never add that JSON to the repository.
6. As an alternative to a secret file, remove/override `GOOGLE_APPLICATION_CREDENTIALS` and set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` to a base64 encoding of the JSON. Do not configure both approaches unnecessarily.
7. Choose the Render instance plan manually. A service that sleeps or is frequently restarted is unsuitable for an active class because sessions are intentionally held in memory.
8. Trigger the first deployment manually, verify `/api/health` returns `{"ok":true}`, and then perform the two-computer test below over the Render HTTPS URL.

Production safeguards include same-origin Socket.IO validation, security headers, a five-attempt limit per connection for the teacher access code, 64 KB WebSocket message limits, inactive-session expiry, and graceful `SIGTERM` cleanup. Run only one Render instance for v0.1 because session state is in memory; horizontal scaling requires a shared session/pub-sub layer.

## Development-only browser-TTS A/B harness

Google Cloud TTS remains the default production path. The comparison UI is absent from the ordinary `/student` route and is enabled only by an explicit development query parameter:

- `/student?devTts=google` — Google Cloud MP3 playback through the normal production queue.
- `/student?devTts=browser` — browser `speechSynthesis` playback of the same translated segments.

For a simultaneous A/B test, join the same teacher session from two Chrome windows or student devices, using one URL for each provider. Press **Start Live Translation** once in both. Do not switch providers after joining; leave and rejoin with the other URL for a clean run.

Both paths use the same sequence ordering, queue estimation, backlog thresholds, playback rates, and `audio:playback` telemetry. Server `[audio-queue]` logs include `provider`, `speechToAudioStartMs`, `translationToAudioStartMs`, `queuedSegments`, `queuedDurationMs`, and `oldestAgeMs`. Compare matching `segmentId` and `sequence` values. Browser voice quality and availability depend on ChromeOS and the installed `es-US` system voice; Google TTS continues to synthesize normally during the experiment so its production behavior is unchanged.

## Two-computer test

1. Connect headphones to Computer B and verify its Chrome output device and volume.
2. On Computer A, open the HTTPS `/teacher` page, share the generated five-character code, select **Start Lecture**, approve microphone access, and speak English naturally.
3. On Computer B, open `/student`, enter the code, select **Join session**, then select **Start Live Translation** once to satisfy Chrome's audio-autoplay policy.
4. Confirm Spanish audio begins automatically for every later segment, never overlaps, and matches the prominent Spanish captions; confirm English remains visible below.
5. Continue for at least 15 minutes. Record the `[latency]` and `[audio-queue]` JSON lines from the server terminal. Check speech recognition, translation, TTS, speech-to-audio-start latency, queue depth/duration/age, and whether delay grows over time.
6. Pause and resume once. Queued speech may finish during pause, but no new cloud work should begin. Temporarily disconnect/rejoin the student and confirm it resumes close to live without replaying the historical audio backlog.
7. End the lecture and confirm student status changes to ended, queued audio finishes safely, and no further Speech, Translation, or TTS calls occur.

## Architecture and safeguards

- Browser AudioWorklet emits mono 16 kHz LINEAR16 chunks around every 100 ms.
- Protected Google clients run only in Node. Interim English is broadcast immediately; only final, stable segments are translated.
- A translation and MP3 synthesis are made once for Spanish per segment and shared with the whole room. The default voice is `es-US-Neural2-A`, a current premium US-Spanish Neural2 voice selected for natural classroom speech. It is configurable via `GOOGLE_TTS_VOICE`.
- Students perform one explicit audio-unlock click. Audio is then played sequentially with no per-segment controls or overlap.
- Translation/TTS preparation runs independently of browser playback, so upcoming segments are prepared while the current one speaks.
- Phrase segmentation does not wait for full sentence finalization: recognition hypotheses at `0.85` stability or higher can commit groups of at least four words. Unless stable punctuation is present, the newest three words remain uncommitted as a revision buffer. The final recognition result translates only the remaining words, preventing duplicated speech while favoring low latency over perfect sentence boundaries. `[segmentation]` server logs identify whether each segment came from a stable interim or final result.
- The queue uses 1.05× normal playback, 1.10× above six estimated seconds, and 1.18× above twelve. If the oldest item exceeds 30 seconds and total queued speech exceeds 20 seconds, it explicitly reports recovery, keeps approximately the newest 12 seconds of audio, and retains all skipped content in captions. This is the documented completeness-versus-liveness tradeoff for v0.1.
- Ending, pausing, or disconnecting the teacher closes recognition. Inactive sessions expire after 30 minutes by default.
- The speech stream rotates before the provider's streaming limit. v0.1 minimizes the boundary gap but does not yet bridge/replay audio across that rotation.
- Sessions and transcripts are memory-only and disappear on server restart. A single server instance is appropriate for the proof of concept; multi-instance Cloud Run requires a shared room/session layer such as Redis.

## Verification

Run `npm test` and `npm run build`. Real speech/translation/TTS and the 2–4 second audio-start goal require configured Google credentials, enabled APIs, real microphones, headphones, and the two-device test above. Do not claim that target until the test is completed.
