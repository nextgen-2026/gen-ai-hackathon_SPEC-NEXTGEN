import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, 
  Palette, 
  Briefcase, 
  Calendar, 
  ChevronRight, 
  ExternalLink, 
  Rocket, 
  User, 
  Target,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Sparkles,
  MessageSquare,
  Send,
  Bot,
  Award,
  Settings,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot 
} from "firebase/firestore";

/**
 * GEMINI API INTEGRATION
 */
const apiKey = ""; 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";

async function generateContent(prompt, systemInstruction = "", jsonMode = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined
  };

  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`API Status: ${response.status}`);
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        console.error("Gemini API Max Retries Reached:", error);
        return null;
      }
      await new Promise(res => setTimeout(res, Math.pow(2, retries) * 1000));
    }
  }
}

/**
 * FIREBASE INITIALIZATION
 */
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "demo", authDomain: "demo.firebaseapp.com", projectId: "demo", appId: "demo" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'career-roadmap-pro';

export default function App() {
  // State
  const [formData, setFormData] = useState({ name: '', interest: '', goal: '', roadmap: null });
  const [view, setView] = useState('input'); 
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const chatEndRef = useRef(null);

  // 1. Auth & Initial Load
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth initialization failed", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'career_plan');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData(data);
        if (data.roadmap) setView('roadmap');
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleGeneratePlan = async () => {
    if (!formData.name || !formData.interest) return;
    setSaving(true);
    
    try {
      const systemPrompt = `You are a world-class career strategist. Create a highly professional 7-step learning roadmap. 
      Format: JSON array of objects. Each object: {"step": "Title", "desc": "3-4 sentences of deep insight", "links": [{"label": "Resource", "url": "URL"}]}. 
      Use high-quality resources like Harvard Business Review, Coursera, or industry-specific documentation.`;
      
      const userPrompt = `Target: ${formData.interest}. Career Goal: ${formData.goal}. User Name: ${formData.name}.`;
      
      const aiResponse = await generateContent(userPrompt, systemPrompt, true);
      
      if (aiResponse) {
        const newRoadmap = JSON.parse(aiResponse);
        const updatedData = { ...formData, roadmap: newRoadmap };
        setFormData(updatedData);

        if (user) {
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'career_plan'), updatedData);
        }
        setChatMessages([{ role: 'assistant', text: `Greetings, ${formData.name}. Your strategic roadmap for ${formData.interest} is now active. I am here to provide granular guidance on any of these phases.` }]);
        setView('roadmap');
      }
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setSaving(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatting(true);

    const systemPrompt = `You are the Lead Mentor for ${formData.name}. You are assisting them in reaching the goal of ${formData.goal} in the field of ${formData.interest}. Use a professional, encouraging, and sophisticated tone.`;
    const context = `Context Roadmap: ${JSON.stringify(formData.roadmap)}. User Message: ${chatInput}`;
    
    const reply = await generateContent(context, systemPrompt);
    setChatMessages(prev => [...prev, { role: 'assistant', text: reply || "I apologize, I'm experiencing a brief connectivity issue. Could you repeat that?" }]);
    setIsChatting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <Rocket className="w-6 h-6 text-indigo-600 absolute animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-slate-800 font-bold text-lg">Initializing System</h3>
            <p className="text-slate-400 text-sm">Synchronizing your professional profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Updated Minimalist Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-start items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter text-slate-800">
              CareerPath<span className="text-indigo-600">.</span>ai
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {view === 'input' ? (
          <div className="grid lg:grid-cols-2 gap-20 items-center min-h-[70vh]">
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Precision Guided Careers
                </div>
                <h1 className="text-6xl md:text-7xl font-black text-slate-900 leading-[0.95] tracking-tighter">
                  Architecting <br />
                  <span className="text-indigo-600">Your Future.</span>
                </h1>
                <p className="text-lg text-slate-500 max-w-md leading-relaxed">
                  The industry-leading AI career strategist. Build rigorous, project-backed roadmaps to master any professional domain.
                </p>
              </div>
            </div>

            {/* Highlighted Form Container */}
            <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.2)] p-10 md:p-14 border-4 border-indigo-600/10 relative overflow-hidden group scale-105 transform">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-100" />
              
              <div className="space-y-8 relative z-10">
                <div className="space-y-4">
                  <label className="block text-xs font-black text-indigo-600 uppercase tracking-[0.2em] ml-1">Professional Identity</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input 
                      type="text" 
                      placeholder="Alex Mercer"
                      className="w-full bg-slate-50 pl-14 pr-6 py-5 rounded-2xl border-2 border-indigo-50 focus:border-indigo-600 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-300 font-bold text-slate-800 shadow-inner"
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-indigo-600 uppercase tracking-[0.2em] ml-1">Domain</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Fintech"
                      className="w-full bg-slate-50 px-6 py-5 rounded-2xl border-2 border-indigo-50 focus:border-indigo-600 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-bold text-slate-800 shadow-inner"
                      onChange={(e) => setFormData({...formData, interest: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-indigo-600 uppercase tracking-[0.2em] ml-1">Apex Goal</label>
                    <input 
                      type="text" 
                      placeholder="e.g. CTO"
                      className="w-full bg-slate-50 px-6 py-5 rounded-2xl border-2 border-indigo-50 focus:border-indigo-600 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-bold text-slate-800 shadow-inner"
                      onChange={(e) => setFormData({...formData, goal: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleGeneratePlan}
                  disabled={saving || !formData.name || !formData.interest}
                  className="w-full relative py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-200 disabled:opacity-50 overflow-hidden group transform hover:scale-[1.02] active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <div className="flex items-center justify-center gap-3">
                    {saving ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-white" />
                    )}
                    {saving ? 'Synthesizing...' : 'Build My Roadmap'}
                  </div>
                </button>
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Gemini 2.5 Flash</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Strategy Sidebar & Timeline */}
            <div className="flex-1 space-y-12">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-slate-200">
                    {formData.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Strategic Plan: {formData.name}</h2>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {formData.interest}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Goal: {formData.goal}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                   <button 
                    onClick={() => setView('input')}
                    className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button 
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-100"
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              {/* Roadmap Timeline */}
              <div className="relative pl-10 space-y-12 before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-slate-50 before:rounded-full">
                {formData.roadmap?.map((step, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-[46px] top-2 w-4 h-4 bg-white border-4 border-indigo-600 rounded-full z-10 shadow-sm group-hover:scale-125 transition-transform" />
                    
                    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/30 hover:-translate-y-1 transition-all duration-500">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Phase 0{idx+1}</span>
                          <div className="h-px w-8 bg-slate-100" />
                          <TrendingUp className="w-4 h-4 text-slate-200" />
                        </div>
                        <Award className="w-6 h-6 text-slate-100 group-hover:text-indigo-200 transition-colors" />
                      </div>
                      
                      <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter">{step.step}</h3>
                      <p className="text-slate-500 leading-relaxed text-[15px] font-medium max-w-2xl">{step.desc}</p>
                      
                      {step.links?.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-50 flex flex-wrap gap-3">
                          {step.links.map((link, lIdx) => (
                            <a 
                              key={lIdx} 
                              href={link.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-slate-50 hover:bg-indigo-600 text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
                            >
                              {link.label} <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Advisor Panel */}
            <aside className="w-full lg:w-[400px] shrink-0 sticky top-28">
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-indigo-100/20 overflow-hidden flex flex-col h-[750px]">
                <div className="p-8 bg-slate-900 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm tracking-tight uppercase tracking-widest">Executive Coach</h4>
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] mt-0.5">Direct AI Access</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-[#FBFCFF]">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-20 opacity-20">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">Awaiting Command</p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-5 py-4 rounded-3xl text-[13px] leading-relaxed font-medium shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' 
                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 px-6 py-4 bg-white rounded-3xl border border-slate-50">
                        <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="p-6 bg-white border-t border-slate-50">
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Consult your advisor..."
                      className="w-full pl-6 pr-14 py-5 bg-slate-50 border border-transparent rounded-[1.5rem] text-[13px] outline-none focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 transition-all font-medium"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button 
                      type="submit" 
                      className="absolute right-2 top-2 w-11 h-11 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer className="mt-32 border-t border-slate-50 py-16 px-6 bg-[#FDFDFF]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3 opacity-30 grayscale">
             <Rocket className="w-5 h-5" />
             <span className="font-black text-sm tracking-tighter">CAREERPATH SYSTEM</span>
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Strategic Intelligence</span>
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Privacy Tier-1</span>
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Infrastructure</span>
          </div>
        </div>
      </footer>
    </div>
  );
}