import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const randomPin = () => {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(a[0] % 10000).padStart(4, "0");
};
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
};
const fingerprint = async (req: Request) => {
  // Hash the forwarded address; raw IP is not persisted. Treat proxy headers as an imperfect signal.
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return sha256(raw + (Deno.env.get("RATE_LIMIT_SALT") || "configure-a-long-random-rate-limit-salt"));
};
async function adminUser(req: Request) {
  const header = req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: admin } = await db.from("admin_users").select("user_id,active").eq("user_id", data.user.id).eq("active", true).maybeSingle();
  return admin ? data.user : null;
}
async function listStudents() {
  const { data, error } = await db.from("students").select("id,full_name,nim,active").eq("active", true).order("full_name");
  if (error) throw error;
  return data || [];
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "list-students") {
      const students = await listStudents();
      return json({ students: students.map(s => ({ id: s.id, full_name: s.full_name })) });
    }
    if (action === "student-login") {
      if (action === "admin-sync") {
        const input = body.state;
        if (!input || !Array.isArray(input.sessions) || input.sessions.length > 500) return json({ error: "Data absensi tidak valid atau terlalu banyak sesi." }, 400);
        const known = new Set((await listStudents()).map(s => s.id));
        let sessionCount = 0, recordCount = 0;
        for (const source of input.sessions) {
          const sid = String(source.id || "");
          const course = String(source.course || "").trim().slice(0, 180);
          const date = String(source.date || "");
          const meeting = Number.parseInt(String(source.meeting || "1"), 10);
          if (!sid || sid.length > 100 || !course || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !Number.isInteger(meeting) || meeting < 1 || meeting > 1000) continue;
          const { error: sessionError } = await db.from("attendance_sessions").upsert({ id: sid, course, session_date: date, meeting, lecturer: String(source.lecturer || "").slice(0, 180), created_by: user.id }, { onConflict: "id" });
          if (sessionError) throw sessionError;
          sessionCount++;
          const records = Object.entries(source.records || {}).filter(([studentId, status]) => known.has(studentId) && ["present","absent","permission","sick","pending"].includes(String(status))).map(([student_id, status]) => ({ session_id: sid, student_id, status: String(status), updated_at: new Date().toISOString() }));
          if (records.length) {
            const { error: recordError } = await db.from("attendance_records").upsert(records, { onConflict: "session_id,student_id" });
            if (recordError) throw recordError;
            recordCount += records.length;
          }
        }
        return json({ success: true, sessions_synced: sessionCount, records_synced: recordCount });
      }
      const studentId = String(body.student_id || "");
      const pin = String(body.pin || "");
      if (!/^student-\d{3}$/.test(studentId) || !/^\d{4}$/.test(pin)) return json({ error: "Nama atau PIN tidak sesuai." }, 400);
      const fp = await fingerprint(req);
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: attempts } = await db.from("student_login_attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("ip_fingerprint", fp).gte("attempted_at", since);
      const { count: studentAttempts } = await db.from("student_login_attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId).gte("attempted_at", since);
      if ((attempts || 0) >= 8 || (studentAttempts || 0) >= 30) return json({ error: "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi." }, 429);
      const { data: account } = await db.from("student_accounts").select("pin_hash").eq("student_id", studentId).maybeSingle();
      const ok = !!account && await bcrypt.compare(pin, account.pin_hash);
      await db.from("student_login_attempts").insert({ student_id: studentId, ip_fingerprint: fp, succeeded: ok });
      if (!ok) return json({ error: "Nama atau PIN tidak sesuai." }, 401);
      const { data: student } = await db.from("students").select("id,full_name").eq("id", studentId).eq("active", true).single();
      if (!student) return json({ error: "Akun mahasiswa tidak aktif." }, 403);
      const tokenBytes = new Uint8Array(32); crypto.getRandomValues(tokenBytes);
      const token = [...tokenBytes].map(b => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256(token);
      await db.from("student_sessions").delete().eq("student_id", studentId);
      const { error: sessionError } = await db.from("student_sessions").insert({ token_hash: tokenHash, student_id: studentId, expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() });
      if (sessionError) throw sessionError;
      return json({ token, student_id: student.id, full_name: student.full_name, expires_in: 28800 });
    }
    if (action === "student-history") {
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Sesi login tidak valid. Silakan login kembali." }, 401);
      const tokenHash = await sha256(token);
      const { data: session } = await db.from("student_sessions").select("student_id,expires_at").eq("token_hash", tokenHash).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!session) return json({ error: "Sesi berakhir. Silakan login kembali." }, 401);
      const { data: student } = await db.from("students").select("id,full_name").eq("id", session.student_id).single();
      const { data: records, error } = await db.from("attendance_records").select("status,attendance_sessions!inner(course,session_date,meeting)").eq("student_id", session.student_id).order("updated_at", { ascending: false });
      if (error) throw error;
      return json({ full_name: student?.full_name || "Mahasiswa", records: (records || []).map((r: any) => ({ status: r.status, course: r.attendance_sessions.course, session_date: r.attendance_sessions.session_date, meeting: r.attendance_sessions.meeting })) });
    }
    if (action === "admin-list" || action === "admin-reset-pin" || action === "admin-sync") {
      const user = await adminUser(req);
      if (!user) return json({ error: "Akses admin ditolak. Gunakan akun admin yang terdaftar." }, 403);
      if (action === "admin-list") {
        const students = await listStudents();
        const { data: accounts, error } = await db.from("student_accounts").select("student_id");
        if (error) throw error;
        const hasPin = new Set((accounts || []).map(a => a.student_id));
        return json({ students: students.map(s => ({ ...s, has_pin: hasPin.has(s.id) })) });
      }
      const studentId = String(body.student_id || "");
      if (!/^student-\d{3}$/.test(studentId)) return json({ error: "Mahasiswa tidak valid." }, 400);
      const { data: student } = await db.from("students").select("id,full_name").eq("id", studentId).eq("active", true).maybeSingle();
      if (!student) return json({ error: "Mahasiswa tidak ditemukan." }, 404);
      let pin = randomPin();
      // Prevent a duplicate PIN among currently enrolled accounts, even though a duplicate is not itself an authorization bypass.
      for (let i = 0; i < 20; i++) {
        const hash = await bcrypt.hash(pin, 12);
        const { data: all } = await db.from("student_accounts").select("pin_hash");
        let duplicate = false;
        for (const a of (all || [])) if (await bcrypt.compare(pin, a.pin_hash)) { duplicate = true; break; }
        if (!duplicate) {
          const { error } = await db.from("student_accounts").upsert({ student_id: studentId, pin_hash: hash, pin_changed_at: new Date().toISOString(), updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "student_id" });
          if (error) throw error;
          await db.from("student_sessions").delete().eq("student_id", studentId);
          return json({ student_id: student.id, full_name: student.full_name, pin });
        }
        pin = randomPin();
      }
      return json({ error: "Tidak dapat membuat PIN unik sekarang. Coba lagi." }, 503);
    }
    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("student-portal error", error);
    return json({ error: "Terjadi kesalahan server. Periksa konfigurasi backend." }, 500);
  }
});
