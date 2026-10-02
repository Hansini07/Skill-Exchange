require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE"] } });

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "skillswap-dev-secret-change-me";
const DB_FILE = path.join(__dirname, "data.json");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], requests: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function publicUser(u) {
  const { password, ...safe } = u;
  return safe;
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
function matchScore(me, other) {
  const teach = new Set((me.teachSkills || []).map(s => s.toLowerCase()));
  const learn = new Set((me.learnSkills || []).map(s => s.toLowerCase()));
  const otherTeach = new Set((other.teachSkills || []).map(s => s.toLowerCase()));
  const otherLearn = new Set((other.learnSkills || []).map(s => s.toLowerCase()));
  let score = 0;
  for (const s of learn) if (otherTeach.has(s)) score += 40;
  for (const s of teach) if (otherLearn.has(s)) score += 40;
  const a = new Set((me.teachingAvailability?.days || []));
  const b = new Set((other.learningAvailability?.days || []));
  if ([...a].some(d => b.has(d))) score += 10;
  const c = new Set((me.learningAvailability?.days || []));
  const d = new Set((other.teachingAvailability?.days || []));
  if ([...c].some(day => d.has(day))) score += 10;
  return Math.min(score, 100);
}

app.get("/api/health", (req,res) => res.json({ ok:true, service:"SkillSwap API", time:new Date().toISOString() }));

app.post("/api/auth/register", async (req,res) => {
  const { name, email, password, department } = req.body;
  if (!name || !email || !password || !department) return res.status(400).json({message:"All fields are required"});
  const db = loadDB();
  const normalized = email.trim().toLowerCase();
  if (db.users.some(u => u.email === normalized)) return res.status(409).json({message:"This email is already registered."});
  const user = {
    id: Date.now().toString(),
    name: name.trim(), email: normalized,
    password: await bcrypt.hash(password, 10),
    department, teachSkills: [], learnSkills: [],
    teachingAvailability:{days:[],from:"6:00 PM",to:"8:00 PM"},
    learningAvailability:{days:[],from:"6:00 PM",to:"8:00 PM"},
    createdAt:new Date().toISOString()
  };
  db.users.push(user); saveDB(db);
  const token = jwt.sign({ id:user.id, email:user.email }, JWT_SECRET, { expiresIn:"7d" });
  res.status(201).json({ token, user:publicUser(user) });
});

app.post("/api/auth/login", async (req,res) => {
  const { email, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.email === String(email||"").trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.password))) return res.status(401).json({message:"Incorrect email or password"});
  const token = jwt.sign({ id:user.id, email:user.email }, JWT_SECRET, { expiresIn:"7d" });
  res.json({ token, user:publicUser(user) });
});

app.get("/api/me", auth, (req,res) => {
  const db=loadDB(); const user=db.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({message:"User not found"});
  res.json({user:publicUser(user)});
});

app.put("/api/profile", auth, (req,res) => {
  const db=loadDB(); const user=db.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({message:"User not found"});
  const allowed=["teachSkills","learnSkills","teachingAvailability","learningAvailability"];
  for(const key of allowed) if(req.body[key] !== undefined) user[key]=req.body[key];
  saveDB(db);
  io.emit("profileUpdated", { user: publicUser(user) });
  res.json({message:"Profile saved", user:publicUser(user)});
});

app.get("/api/users", auth, (req,res) => {
  const db=loadDB();
  const users=db.users.filter(u=>u.id!==req.user.id).map(u=>({...publicUser(u),matchScore:matchScore(db.users.find(x=>x.id===req.user.id),u)}));
  res.json({users});
});

app.get("/api/matches", auth, (req,res) => {
  const db=loadDB(); const me=db.users.find(u=>u.id===req.user.id);
  const matches=db.users.filter(u=>u.id!==me.id).map(u=>({...publicUser(u),matchScore:matchScore(me,u)}))
    .sort((a,b)=>b.matchScore-a.matchScore);
  res.json({matches});
});

app.post("/api/requests", auth, (req,res) => {
  const { toUserId, learnSkill, teachSkill, sessions, day, time }=req.body;
  const db=loadDB(); const from=db.users.find(u=>u.id===req.user.id); const to=db.users.find(u=>u.id===toUserId);
  if(!to) return res.status(404).json({message:"Student not found"});
  const request={id:Date.now().toString(),fromUserId:from.id,from:from.name,toUserId:to.id,to:to.name,learnSkill,teachSkill,sessions,day,time,mode:"Online",status:"Pending",createdAt:new Date().toISOString()};
  db.requests.push(request); saveDB(db);
  io.emit("requestCreated", request);
  res.status(201).json({request});
});

app.get("/api/requests", auth, (req,res) => {
  const db=loadDB();
  const requests=db.requests.filter(r=>r.fromUserId===req.user.id || r.toUserId===req.user.id);
  res.json({requests});
});

app.patch("/api/requests/:id", auth, (req,res) => {
  const db=loadDB(); const r=db.requests.find(x=>x.id===req.params.id);
  if(!r || (r.fromUserId!==req.user.id && r.toUserId!==req.user.id)) return res.status(404).json({message:"Request not found"});
  if(!["Pending","Accepted","Rejected","Completed"].includes(req.body.status)) return res.status(400).json({message:"Invalid status"});
  r.status=req.body.status; r.updatedAt=new Date().toISOString(); saveDB(db);
  io.emit("requestUpdated", r); res.json({request:r});
});

io.on("connection", socket => {
  socket.emit("connected", {message:"Connected to SkillSwap realtime server"});
});

server.listen(PORT, () => console.log(`SkillSwap API running at http://localhost:${PORT}`));
