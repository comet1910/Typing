"use strict";

const courses = {
  symbols: {name:"标点定位", note:"切到英文输入，空格也要输入。", lessons:[
    ", . , . / ? / ?", "; : ; : ' \" ' \"", "( ) ! ? ( ) ! ?", ". , ; : ? ! ' \"", "，。！？；：，。！？；：", "、（）《》、（）《》"
  ]},
  en: {name:"英文短句", note:"使用英文输入，留意大小写与空格。", lessons:[
    "Hi, Sam. Are you free?", "It's late; let's go.", "Wait! Is this yours?", "She said, \"See you at six.\"", "Tea (or coffee), please.", "Yes, I'm ready. Shall we go?"
  ]},
  zh: {name:"中文短句", note:"使用中文标点，选字上屏后计分。", lessons:[
    "下雨了，带伞了吗？", "太好了！明天见。", "清单：苹果、香蕉、牛奶。", "早上开会；下午写稿。", "你读过《春》吗？", "她说：“慢慢来。”"
  ]},
  review: {name:"易错复习", note:"按目标字符切换中英文输入。"}
};
const keyRows = [
  [["\x60","~"],..."1234567890".split("").map((c,i)=>[c,"!@#$%^&*()"[i]]),["-","_"],["=","+"],["Delete",1.6]],
  [["Tab",1.5],...Array.from("qwertyuiop"),["[","{"],["]","}"],["\\","|"]],
  [["Caps",1.8],...Array.from("asdfghjkl"),[";",":"],["'","\""],["Enter",1.9]],
  [["Shift",2.2],...Array.from("zxcvbnm"),[",","<"],[".",">"],["/","?"],["Shift",2.4]],
  [["Ctrl",1],["Alt",1],["Cmd",1],["Space",6],["Cmd",1],["Alt",1],["Ctrl",1]]
];
const chineseKeys = {"，":",","。":".","？":"?","！":"!","；":";","：":":","、":"\\","（":"(","）":")","《":"<","》":">","“":"\"","”":"\""};
const shelfKey = "easy-typing.rounds.v1";
const $ = id => document.getElementById(id);
const showChar = ch => ch === " " ? "空格" : ch;
const isPunctuation = ch => /[\p{P}\p{S}]/u.test(ch);
const percent = (hit,total) => total ? (100 * hit / total).toFixed(1).replace(/\.0$/,"") + "%" : "—";
const keyMap = new Map();
const keys = [];
let records = [];
let saveAvailable = true;
try {
  const data = JSON.parse(localStorage.getItem(shelfKey) || "[]");
  if (Array.isArray(data)) records = data.filter(r => r && Object.hasOwn(courses,r.mode) && Number.isFinite(r.total) && Number.isFinite(r.first) && Array.isArray(r.misses)).slice(-50);
} catch { saveAvailable = false; }
let mode = "symbols";
const lessonNo = {symbols:0,en:0,zh:0};
let target, index, missedHere, first, pFirst, pTotal, attemptsWrong, misses, complete, usedHints, recentReview;
let composing = false;
const entry = $("entry");

for (const group of keyRows) {
  const row = document.createElement("div");
  row.className = "row";
  for (const item of group) {
    const [base, top] = Array.isArray(item) ? item : [item];
    const mod = typeof top === "number";
    const el = document.createElement("span");
    el.className = mod ? "key mod" : "key";
    if (mod) el.style.flex = String(top);
    if (typeof top === "string") {
      const upper = document.createElement("i");
      upper.textContent = top;
      el.append(upper);
      keyMap.set(top,{base,shift:true});
    }
    el.append(document.createTextNode(mod ? base : base.toUpperCase()));
    if (!mod) {
      keyMap.set(base,{base,shift:false});
      if (/[a-z]/.test(base)) keyMap.set(base.toUpperCase(),{base,shift:true});
    }
    keys.push({base,el});
    row.append(el);
  }
  $("keyboard").append(row);
}
keyMap.set(" ",{base:"Space",shift:false});

function rankedMisses() {
  const sums = new Map();
  for (const round of records.slice(-12)) {
    for (const [ch,n] of round.misses) sums.set(ch,(sums.get(ch) || 0) + n);
  }
  return [...sums].sort((a,b)=>b[1]-a[1]);
}
function reviewText() {
  const chars = rankedMisses().slice(0,4).map(([ch])=>ch);
  if (!chars.length) return "";
  return [...chars,...chars.slice(1),chars[0],...chars.slice().reverse()].join("");
}
function note() {
  if (mode === "symbols" && lessonNo.symbols >= 4) return "切到中文标点，按题面连续输入。";
  return courses[mode].note;
}
function start(text, focus = true) {
  const lesson = text ?? (mode === "review" ? reviewText() : courses[mode].lessons[lessonNo[mode]]);
  if (!lesson && mode === "review") {
    mode = "symbols";
    start(undefined,focus);
    return;
  }
  if (mode === "review") recentReview = lesson;
  target = [...lesson];
  index = first = pFirst = pTotal = attemptsWrong = 0;
  missedHere = complete = composing = false;
  usedHints = $("hints").checked;
  misses = new Map();
  entry.disabled = !target.length;
  entry.value = "";
  $("title").textContent = courses[mode].name;
  $("prompt").replaceChildren(...target.map(ch=>{
    const el = document.createElement("span");
    el.textContent = ch === " " ? "␣" : ch;
    return el;
  }));
  $("feedback").className = "";
  $("feedback").textContent = note();
  paint(); sidebar();
  if (focus) entry.focus();
}
function paintHint() {
  const ch = target[index];
  const mapping = keyMap.get(chineseKeys[ch] || ch);
  const enabled = $("hints").checked && !!ch;
  const shiftBase = mapping?.shift && (/[qwertasdfgzxcvb1-5\x60]/.test(mapping.base) ? keys.filter(k=>k.base==="Shift").at(-1) : keys.find(k=>k.base==="Shift"));
  for (const key of keys) key.el.classList.toggle("lit",!!(enabled && (key.base === mapping?.base || key === shiftBase)));
  let hint = "本轮已完成。";
  if (ch && !enabled) hint = "键位提示已关闭，可自行回忆后输入。";
  else if (ch && !mapping) hint = "汉字请使用你熟悉的输入法，确认候选词后继续。";
  else if (ch) {
    const combo = (mapping.shift ? "Shift + " : "") + mapping.base.toUpperCase();
    hint = "「" + showChar(ch) + "」 · " + combo + (chineseKeys[ch] ? " · 常见中文标点映射，以输入法设置为准" : " · 美式 QWERTY");
  }
  $("keyhint").textContent = hint;
}
function paint() {
  const spans = $("prompt").children;
  for (let i=0;i<spans.length;i++) spans[i].className = i < index ? "done" : i === index ? (missedHere ? "active miss" : "active") : "";
  $("counter").textContent = index + " / " + target.length + " 字符";
  $("bar").style.width = (target.length ? index / target.length * 100 : 0) + "%";
  const tried = index + Number(missedHere);
  $("accuracy").textContent = percent(first,tried);
  $("hits").textContent = first + " / " + tried;
  $("punct").textContent = pFirst + " / " + (pTotal + Number(missedHere && isPunctuation(target[index])));
  $("errors").textContent = attemptsWrong;
  $("next").textContent = complete ? "下一题" : "换一题";
  paintHint();
}
function row(parent,left,right) {
  const line = document.createElement("div");
  line.className = "record";
  const a = document.createElement("span"), b = document.createElement("b");
  a.textContent = left; b.textContent = right; line.append(a,b);parent.append(line);
}
function empty(parent,msg) {
  const p = document.createElement("p");p.className = "empty";p.textContent = msg;parent.append(p);
}
function sidebar() {
  const weak = $("weak"), history = $("history"), ranked = rankedMisses();
  weak.replaceChildren(); history.replaceChildren();
  for (const [ch,n] of ranked.slice(0,4)) row(weak,"「" + showChar(ch) + "」",n + " 处");
  if (!ranked.length) empty(weak,"完成练习后，这里会列出首次打错的字符。");
  $("review").disabled = !ranked.length;
  for (const r of records.slice(-4).reverse()) {
    const date = new Date(r.date);
    row(history,(date.getMonth()+1) + "/" + date.getDate() + " " + courses[r.mode].name + (r.hints ? " · 有提示" : " · 无提示"),percent(r.first,r.total));
  }
  if (!records.length) empty(history,"完成第一轮后即可查看成绩。");
  $("storage").textContent = saveAvailable ? "练习记录保存在当前浏览器。" : "浏览器存储不可用，本次记录仅在页面内保留。";
  for (const btn of document.querySelectorAll(".modes button")) btn.setAttribute("aria-pressed",String(btn.dataset.mode === mode));
}
function finish() {
  complete = true;
  entry.disabled = true;
  records.push({mode, date:Date.now(), first,total:index,pFirst,pTotal,hints:usedHints,misses:[...misses]});
  records = records.slice(-50);
  try { localStorage.setItem(shelfKey,JSON.stringify(records)); saveAvailable = true; } catch { saveAvailable = false; }
  $("feedback").textContent = "本轮完成。首次命中 " + first + " / " + index + (misses.size ? "，可到易错复习再练一次。" : "，所有字符都一次打对了。");
  sidebar(); $("next").focus();
}
function consume(value) {
  if (complete || !value) return;
  for (const ch of value) {
    const expected = target[index];
    if (ch !== expected) {
      if (!missedHere) misses.set(expected,(misses.get(expected) || 0) + 1);
      missedHere = true; attemptsWrong++;
      $("feedback").className = "bad";
      $("feedback").textContent = "收到「" + showChar(ch) + "」，请从「" + showChar(expected) + "」继续。";
      break;
    }
    if (!missedHere) first++;
    if (isPunctuation(ch)) { pTotal++; if (!missedHere) pFirst++; }
    index++; missedHere = false;
    $("feedback").className = ""; $("feedback").textContent = note();
    if (index === target.length) { finish(); break; }
  }
  paint();
}
function flush() {
  const value = entry.value;
  entry.value = "";
  consume(value);
}
entry.addEventListener("compositionstart",()=>{composing = true;});
entry.addEventListener("compositionend",()=>{
  composing = false;
  // Some browsers emit the committed input after compositionend.
  setTimeout(()=>{if (!composing && entry.value) flush();},0);
});
entry.addEventListener("input",e=>{if (!composing && !e.isComposing) flush();});
for (const type of ["paste","drop"]) entry.addEventListener(type,e=>{e.preventDefault(); $("feedback").textContent = "请使用键盘输入本题。";});
$("hints").onchange = ()=>{if (!complete && $("hints").checked) usedHints = true; paintHint(); if (!complete) entry.focus();};
function selectMode(nextMode) {mode = nextMode; start();}
for (const id of ["symbols","en","zh"]) {
  const btn = document.createElement("button");
  btn.textContent = courses[id].name;btn.dataset.mode = id;
  btn.onclick = ()=>selectMode(id);document.querySelector(".modes").append(btn);
}
$("review").onclick = ()=>selectMode("review");
$("next").onclick = ()=>{
  if (mode !== "review") lessonNo[mode] = (lessonNo[mode]+1) % courses[mode].lessons.length;
  start();
};
$("again").onclick = ()=>start(mode === "review" ? recentReview : undefined);
start(undefined,false);
