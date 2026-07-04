// Setup da persona neutra de demonstração (Votia) para o pipeline V2.
//
// 1. Sobe os assets no Storage (voice-models):
//      base-models/demonstracao/base.mp4          (vídeo base — fallback do lipsync)
//      v2/themes/demonstracao/padrao.mp4          (original, com intro do nome)
//      v2/themes/demonstracao/padrao_trimmed.mp4  (sem os 2.80s da intro)
//      assets/closing_demonstracao.mp4            (encerramento Votia, 3s)
// 2. Clona a voz da persona no ElevenLabs a partir do áudio do próprio vídeo
//    (reusa a voz se já existir com o mesmo nome — idempotente).
// 3. Upsert em v2_base_models (slug 'demonstracao') + v2_theme_models ('padrao').
//
// Fontes locais: demonstracao-neutro.mp4 + scratch-demo/ (gerados via ffmpeg).
// Rodar da raiz do repo: node scripts/setup-demonstracao.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      const k = l.slice(0, idx).trim();
      let v = l.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [k, v];
    }),
);

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const EL_KEY = env.ELEVENLABS_API_KEY;
if (!SUPA_URL || !SUPA_KEY || !EL_KEY) {
  console.error('Missing env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY)');
  process.exit(1);
}

const SLUG = 'demonstracao';
const VOICE_NAME = 'Voz_Demonstracao_Votia';

const UPLOADS = [
  { local: 'demonstracao-neutro.mp4', remote: `base-models/${SLUG}/base.mp4` },
  { local: 'demonstracao-neutro.mp4', remote: `v2/themes/${SLUG}/padrao.mp4` },
  { local: 'scratch-demo/padrao_trimmed.mp4', remote: `v2/themes/${SLUG}/padrao_trimmed.mp4` },
  { local: 'scratch-demo/closing_demonstracao.mp4', remote: `assets/closing_demonstracao.mp4` },
];

for (const { local } of UPLOADS) {
  if (!existsSync(local)) {
    console.error(`Local file not found: ${local}`);
    process.exit(1);
  }
}

const supa = createClient(SUPA_URL, SUPA_KEY);

// ── 1. Storage ──────────────────────────────────────────────
console.log('1/3 — Uploading assets to Storage...');
for (const { local, remote } of UPLOADS) {
  const buf = readFileSync(local);
  const { error } = await supa.storage.from('voice-models').upload(remote, buf, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (error) {
    console.error(`    Upload failed for ${remote}:`, error);
    process.exit(1);
  }
  console.log(`    ${remote} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
}

// ── 2. Voz (ElevenLabs) ─────────────────────────────────────
console.log('2/3 — Ensuring cloned voice on ElevenLabs...');
let voiceId = null;

const listRes = await fetch('https://api.elevenlabs.io/v1/voices', {
  headers: { 'xi-api-key': EL_KEY },
});
if (listRes.ok) {
  const { voices } = await listRes.json();
  const found = voices?.find(v => v.name === VOICE_NAME);
  if (found) {
    voiceId = found.voice_id;
    console.log(`    Voice already exists: ${voiceId}`);
  }
}

if (!voiceId) {
  const tmpAudio = `_demo_voice_${Date.now()}.mp3`;
  execFileSync('ffmpeg', [
    '-y', '-i', 'demonstracao-neutro.mp4',
    '-vn', '-ac', '1', '-ar', '44100',
    '-c:a', 'libmp3lame', '-b:a', '128k',
    tmpAudio,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  const audioBuf = readFileSync(tmpAudio);
  console.log(`    Extracted audio: ${(statSync(tmpAudio).size / 1024).toFixed(0)} KB`);

  const form = new FormData();
  form.append('name', VOICE_NAME);
  form.append('files', new Blob([audioBuf], { type: 'audio/mpeg' }), 'demo_voice.mp3');
  form.append('remove_background_noise', 'true');
  form.append('labels', JSON.stringify({ language: 'pt-BR' }));

  const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY },
    body: form,
  });
  unlinkSync(tmpAudio);
  if (!elRes.ok) {
    console.error(`    ElevenLabs ${elRes.status}:`, (await elRes.text()).slice(0, 600));
    process.exit(1);
  }
  voiceId = (await elRes.json()).voice_id;
  console.log(`    Voice cloned: ${voiceId}`);
}

// ── 3. Banco (v2_base_models + v2_theme_models) ─────────────
console.log('3/3 — Upserting v2_base_models + v2_theme_models...');

const baseModel = {
  slug: SLUG,
  name: 'Demonstração Votia',
  display_name: 'Demonstração',
  video_storage_path: `base-models/${SLUG}/base.mp4`,
  elevenlabs_voice_id: voiceId,
  voice_name: VOICE_NAME,
  prompt_template: '',
  video_strategy: 'name_sync',
  greeting_template: 'Obrigado pela sua mensagem, {nome}!',
  theme_intro_seconds: 2.8,
  lipsync_config: {
    model: 'lipsync-2-pro',
    sync_mode: 'loop',
    temperature: 0.3,
    // Trilha instrumental contínua sob o vídeo todo (corpo + closing),
    // mesmo padrão do ricardomarques. O closing (silencioso) fica coberto
    // pelo bed, que faz fade-out no final.
    full_music: { path: 'assets/closing_music.mp3', volume: 0.08 },
  },
  closing_video_path: 'assets/closing_demonstracao.mp4',
  // 'none' mantém o áudio original do closing (silêncio) — sem trilha do PL.
  closing_music_path: 'none',
  whatsapp_message_template: 'Olá, {name}! Obrigado pela sua mensagem — aqui está seu vídeo. 🎬',
  thank_you_message: 'Recebemos seu depoimento! Em instantes você recebe um vídeo personalizado no seu WhatsApp.',
  is_active: true,
};

const { data: bm, error: bmErr } = await supa
  .from('v2_base_models')
  .upsert(baseModel, { onConflict: 'slug' })
  .select('id, slug')
  .single();
if (bmErr || !bm) {
  console.error('    v2_base_models upsert failed:', bmErr);
  process.exit(1);
}
console.log(`    v2_base_models: ${bm.slug} → ${bm.id}`);

// Só o tema 'padrao' — o classificador fica escopado a ele e todo
// depoimento cai no vídeo único da persona.
const { error: tmErr } = await supa
  .from('v2_theme_models')
  .upsert(
    {
      base_model_id: bm.id,
      theme_slug: 'padrao',
      video_storage_path: `v2/themes/${SLUG}/padrao_trimmed.mp4`,
      is_uploaded: true,
    },
    { onConflict: 'base_model_id,theme_slug' },
  );
if (tmErr) {
  console.error('    v2_theme_models upsert failed:', tmErr);
  process.exit(1);
}
console.log(`    v2_theme_models: padrao → v2/themes/${SLUG}/padrao_trimmed.mp4`);

console.log('\n✓ Persona demonstracao pronta.');
console.log(`  base_model_id       = ${bm.id}`);
console.log(`  elevenlabs_voice_id = ${voiceId}`);
console.log(`  Página: /selfie-video/${SLUG}`);
