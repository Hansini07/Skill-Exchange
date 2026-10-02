
<!-- SkillSwap backend integration -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
<script>
const API_BASE = "http://localhost:5000/api";
let apiToken = localStorage.getItem("skillSwapToken") || null;

async function api(path, options={}) {
  const headers = {"Content-Type":"application/json", ...(options.headers||{})};
  if (apiToken) headers.Authorization = "Bearer " + apiToken;
  const response = await fetch(API_BASE + path, {...options, headers});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.message || "Server error");
  return data;
}

async function registerUserBackend(event) {
  event.preventDefault();
  const name=document.getElementById("regName").value.trim();
  const email=document.getElementById("regEmail").value.trim().toLowerCase();
  const password=document.getElementById("regPassword").value;
  const confirm=document.getElementById("regConfirmPassword").value;
  const department=document.getElementById("regDepartment").value;
  if(password!==confirm) return showToast("Passwords do not match ❌");
  try {
    const data=await api("/auth/register",{method:"POST",body:JSON.stringify({name,email,password,department})});
    apiToken=data.token; localStorage.setItem("skillSwapToken",apiToken);
    currentUser=data.user;
    showToast("Account created! 🎉"); updateNavbar();
    setTimeout(()=>showView("completeProfile"),500);
  } catch(e){ showToast(e.message+" ❌"); }
}

async function loginUserBackend(event) {
  event.preventDefault();
  const email=document.getElementById("loginEmail").value.trim().toLowerCase();
  const password=document.getElementById("loginPassword").value;
  try {
    const data=await api("/auth/login",{method:"POST",body:JSON.stringify({email,password})});
    apiToken=data.token; localStorage.setItem("skillSwapToken",apiToken);
    currentUser=data.user; showToast("Welcome back! 🎉"); updateNavbar();
    setTimeout(()=>showView("dashboard"),500);
  } catch(e){ showToast(e.message+" ❌"); }
}

async function saveProfileBackend(event) {
  event.preventDefault();
  if(!currentUser) return;
  const teachDays=[...document.querySelectorAll('input[name="teachDays"]:checked')].map(x=>x.value);
  const learnDays=[...document.querySelectorAll('input[name="learnDays"]:checked')].map(x=>x.value);
  try {
    const data=await api("/profile",{method:"PUT",body:JSON.stringify({
      teachSkills:[...teachSkills], learnSkills:[...learnSkills],
      teachingAvailability:{days:teachDays,from:document.getElementById("teachFrom").value,to:document.getElementById("teachTo").value},
      learningAvailability:{days:learnDays,from:document.getElementById("learnFrom").value,to:document.getElementById("learnTo").value}
    })});
    currentUser=data.user; showToast("Your profile has been saved! 🌱");
    setTimeout(()=>showView("dashboard"),500);
  } catch(e){showToast(e.message+" ❌");}
}

async function loadBackendMatches(){
  if(!apiToken) return;
  try {
    const data=await api("/matches");
    window.skillSwapMatches=data.matches;
    return data.matches;
  } catch(e){console.error(e);}
}

async function submitRequestBackend(event) {
  event.preventDefault();
  if(!currentUser) return showToast("Please login first.");
  const targetName=document.getElementById("requestPerson").value;
  const matches=await loadBackendMatches();
  const target=matches.find(x=>x.name===targetName);
  if(!target) return showToast("Student not found on server.");
  try {
    await api("/requests",{method:"POST",body:JSON.stringify({
      toUserId:target.id,
      learnSkill:document.getElementById("requestLearnSkill").value,
      teachSkill:document.getElementById("requestTeachSkill").value,
      sessions:document.querySelector('input[name="sessions"]:checked').value,
      day:document.getElementById("requestDay").value,
      time:document.getElementById("requestTime").value
    })});
    closeRequestModal(); showToast("Swap request sent! 🎉"); await loadRequestsBackend();
  } catch(e){showToast(e.message+" ❌");}
}

async function loadRequestsBackend(){
  if(!apiToken) return [];
  try {
    const data=await api("/requests");
    window.skillSwapRequests=data.requests;
    requests=data.requests;
    updateRequests();
    updateDashboard();
    return data.requests;
  } catch(e){console.error(e); return [];}
}

function connectSkillSwapRealtime(){
  const socket=io("http://localhost:5000");
  socket.on("requestCreated",()=>{if(apiToken)loadRequestsBackend();});
  socket.on("requestUpdated",()=>{if(apiToken)loadRequestsBackend();});
  socket.on("profileUpdated",async event=>{
    if(currentUser && event.user && event.user.id===currentUser.id){
      currentUser=event.user; updateDashboard(); updateProfile();
    }
  });
}
connectSkillSwapRealtime();
</script>
