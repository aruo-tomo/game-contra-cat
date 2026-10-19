// Chinese (Cantonese) / English text. Language: ?lang=en|zh in the URL, else the saved choice, else the browser's.
// Static HTML is tagged data-i18n / data-i18n-html / data-i18n-aria; code calls t(key, vars).

const STORE_KEY = 'contracat.lang';

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s === 'en' || s === 'zh') return s;
  } catch { /* storage blocked */ }
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const lang = pickLang();

const zh = {
  'doc.title': '喵斗羅 Contra-Cat',
  'canvas.aria': '喵斗羅遊戲畫面',
  'hud.sound': '聲音', 'hud.muted': '靜音', 'hud.pause': '暫停',
  'title.tag': '赤鼠帝國洗腦咗全城隻貓。兩隻怪貓突擊隊出動，打醒佢哋！',
  'title.solo': '單人出擊', 'title.coop': '雙人合作',
  'title.story': '睇故事',
  'pick.aria': '揀角色', 'pick.title': '揀角色', 'pick.sub': '雙人合作時，P2 用另一隻',
  'blaze.name': '火斑 Blaze', 'gulp.name': '大口 Gulp',
  'blaze.skill': '三眼光炮', 'gulp.skill': '肚口吞彈',
  'blaze.skillDesc': '專屬技：三眼光炮射穿成個畫面，再鎖定敵人自動追蹤',
  'gulp.skillDesc': '專屬技：肚口吞彈，再噴出射穿成個畫面嘅彈幕',
  'bar.mode': '操作', 'bar.diff': '難度', 'bar.lang': '語言',
  'bar.stage': '關卡', 'clear.next': '下一關',
  'clear.title4': '第四關完成！', 'clear.text4': '腦波蜘蛛機甲炸咗，鼠博士坐住駕駛艙逃走咗。下一站：雪櫃冰原（製作中）。',
  'say.stage4': '第四關　寵物醫院地庫', 'say.drill': '中 Boss：赤鼠鑽頭工兵', 'say.drillDown': '鑽頭工兵跌落井底！', 'say.spider': '鼠博士 腦波蜘蛛機甲',
  'boss.drill': '赤鼠鑽頭工兵', 'boss.spider': '腦波蜘蛛機甲・鼠博士', 'hypno.hit': '頭暈！左右調轉！',
  'spider.phase2': '爬上天花！', 'spider.phase3': '腳斷晒！駕駛艙飛起！', 'lift.go': '升降機落緊…', 'tesla.zap': '電！',
  'clear.title3': '第三關完成！', 'clear.text3': '機械錦鯉沉咗，鼠水軍提督游走咗。下一站：寵物醫院地庫。',
  'say.stage3': '第三關　大魚缸瀑布', 'say.pirate': '中 Boss：海盜船長貓', 'say.koi': '鼠水軍提督・機械錦鯉', 'say.pirateFreed': '解放咗海盜船長貓！',
  'boss.pirate': '海盜船長貓（被洗腦）', 'boss.koi': '機械錦鯉・鼠水軍提督', 'pirate.yarr': '呀——！',
  'koi.phase2': '裝甲爆開！佢嬲咗！', 'koi.phase3': '提督：全速前進！', 'koi.slam': '跳水！',
  'air.low': '冇乜氣喇！', 'air.out': '窒息！', 'dive.tip': '潛水：撳跳＝向上划，注意氧氣條！',
  'clear.title1': '第一關完成！', 'clear.text1': '貓抓板要塞倒咗。下一站：寵物醫院走廊。',
  'clear.title2': '第二關完成！', 'clear.text2': '鼠醫生手術機械人散咗。下一站：大魚缸瀑布。',
  'say.stage2': '第二關　寵物醫院走廊',
  'say.headnurse': '中 Boss：赤鼠護士長', 'say.surgeon': '赤鼠軍 鼠醫生手術機械人', 'say.nurseDown': '護士長收工！',
  'boss.headnurse': '赤鼠護士長', 'boss.surgeon': '手術機械人・鼠醫生玻璃樽', 'boss.jar': '鼠醫生',
  'nurse.heal': '+補血', 'nurse.charge': '打針啦！', 'cone.yowl': '喵嗷——！', 'surgeon.cut': '開刀！',
  'mode.pc': '滑鼠＋鍵盤', 'mode.classic': '經典鍵盤', 'mode.touch': '觸控',
  'diff.nine': '九命貓', 'diff.classic': '經典',
  'title.settings': '設定同操作說明',
  'title.best': '最高紀錄 {score}・{rank} 級',
  'pause.title': '暫停', 'pause.resume': '繼續', 'pause.keys': '鍵位設定', 'pause.quit': '返回標題',
  'over.title': '全軍覆沒', 'stat.score': '分數', 'over.continue': '接關', 'over.continueN': '接關（仲有 {n} 次）',
  'clear.title': '第一關完成！', 'clear.text': '貓抓板要塞倒咗。下一站：寵物醫院走廊（製作中）。',
  'stat.freed': '解放貓數', 'stat.time': '用時', 'stat.deaths': '倒下次數',
  'clear.rankInfo': '評級：4 分鐘內過關、冇倒下、解放七成以上嘅貓、30000 分以上，每達成一項加一級（C → S）。',
  'clear.again': '再玩一次',
  'clear.newBest': '新紀錄！之前最高 {score}', 'clear.first': '第一次過關，已記錄成績', 'clear.best': '最高紀錄 {score}（{rank} 級）',
  'set.title': '設定', 'set.mode': '操作方式', 'set.music': '音樂音量', 'set.sfx': '音效音量',
  'set.legend.pc': '<b>P1</b> <kbd>A</kbd><kbd>D</kbd> 行　<kbd>S</kbd> 伏低　<kbd>Space</kbd> 跳（空中再撳＝二段跳）<br>滑鼠瞄準，<b>按住左鍵</b>連射　<kbd>左 Shift</kbd> 閃避衝刺　<b>右鍵</b>／<kbd>E</kbd> 專屬技<br><b>P2</b> 用手掣（右搖桿推出去就射），或者用鍵盤 <kbd>←↑→↓</kbd> 行、數字鍵 <kbd>1</kbd> 跳，見到敵人自動射',
  'set.legend.classic': '<b>自動瞄準開咗</b>：槍會自己對準最近嘅敵人連射，你只需要行同跳。撳住 <kbd>W</kbd> 可以臨時向上射。<br><b>P1</b> <kbd>A</kbd><kbd>D</kbd> 行　<kbd>S</kbd> 伏低　<kbd>J</kbd> 跳　<kbd>K</kbd> 衝刺　<kbd>I</kbd> 專屬技（自動瞄準關咗時：<kbd>W</kbd> 向上瞄、<kbd>L</kbd> 鎖定站位）<br><b>P2</b> <kbd>←↑→↓</kbd> 行　數字鍵 <kbd>1</kbd> 跳　<kbd>2</kbd> 衝刺　<kbd>3</kbd> 鎖定　<kbd>5</kbd> 專屬技',
  'set.legend.touch': '左邊搖桿行（向下＝伏低），右邊搖桿推去邊就射去邊。<br><b>跳</b>（空中再撳＝二段跳）、<b>衝</b> 閃避衝刺、<b>技</b> 專屬技。接手掣可以加入 P2。',
  'set.shake': '畫面震動', 'on': '開', 'off': '關',
  'set.autoaim': '自動瞄準', 'set.autoaimOn': '開：專心行同跳', 'set.autoaimOff': '關：自己瞄',
  'set.assist': '瞄準輔助', 'assist.normal': '標準', 'assist.strong': '強',
  'set.keys': '鍵位', 'tab.classic1': '經典 P1', 'tab.classic2': '經典 P2',
  'set.keysHelp': '撳個掣再撳新嘅鍵就改到。手掣同觸控用固定配置。',
  'set.reset': '重設鍵位', 'set.done': '完成',
  'set.also': '另有：', 'set.aim': '瞄準', 'set.mouse': '滑鼠', 'set.fire': '射擊', 'set.holdLeft': '按住左鍵',
  'set.skillAlt': '專屬技（另一個）', 'set.rightBtn': '右鍵',
  'scope.pc': '「滑鼠＋鍵盤」模式嘅 P1 用', 'scope.classic1': '「經典鍵盤」模式嘅 P1 用',
  'scope.classic2': '「經典鍵盤」模式嘅 P2 用；「滑鼠＋鍵盤」雙人而又冇第二個手掣時，P2 亦用呢組',
  'scope.line': '呢組鍵：{scope}。', 'scope.unused': '你而家揀咗「{mode}」，所以呢組鍵暫時唔會用到。',
  'set.pressKey': '撳一個鍵…（Esc 取消）', 'toast.reset': '鍵位已重設為預設',
  'toast.autoaim': '自動瞄準已開：專心行同跳就得（設定入面可以關）',
  'toast.konami': '秘技成功：下一局 30 條命！',
  'toast.meowOn': '秘技：喵喵槍！下一局每粒子彈都係「喵」', 'toast.meowOff': '喵喵槍已關',
  'toast.jukebox': '秘技：音樂盒已開！撳標題畫面嘅 ♪ 掣聽歌',
  'title.jukebox': '♪ 音樂盒',
  'combo.big': '{n} 連殺！', 'hud.combo': '{n} COMBO', 'stomp': '踩！',
  'say.bossDown': '擊破！', 'clear.perfect': '無傷通關 +10000',
  'secret.lost': '失物認領', 'secret.got': '金罐頭！+1 命',
  'secret.count': '秘密金罐頭 {n}／4', 'secret.all': '全部搵齊！標題畫面開咗音樂盒',
  'secret.stomp': '秘技發現：踩頭！',
  'load.aria': '載入進度', 'load.text': '載入緊… {pct}%（{done}／{total}）', 'load.fail': '載入唔到 {name}', 'load.reload': '，請重新載入。',
  'tip.1': '貼士：打敵人儲能量，能量條閃就可以放必殺！',
  'tip.2': '貼士：射爆飛天罐頭，執武器字母換槍。',
  'tip.3': '貼士：雙人模式，隊友倒地就企喺佢隔籬一秒，舔醒佢。',
  'tip.4': '貼士：衝刺嗰一下係無敵嘅，用嚟穿過子彈。',
  'rotate': '打橫部手機玩，畫面會大好多',
  // in game
  'freed.1': '喵～', 'freed.2': '多謝！', 'freed.3': '醒返啦！', 'freed.4': '我自由喇！',
  'say.stage1': '第一關　後巷貓草叢', 'say.go': '出發！', 'say.join': 'P{n} 加入！',
  'say.midboss': '中 Boss：三眼肥白貓', 'say.fortress': '赤鼠軍 貓抓板要塞', 'say.eliteFreed': '解放咗三眼肥白貓！',
  'boss.fortress': '貓抓板要塞・鼠眼核心', 'boss.elite': '三眼肥白貓（被洗腦）', 'boss.core': '鼠眼核心',
  'squeak': '吱！', 'elite.roar': '喵嗚——！',
  'hud.p2join': 'P2 加入：手掣撳 A，或者撳 {key}', 'hud.skill': 'P{n} 撳 {key} 必殺！',
  'hud.dead': '復活中…', 'hud.out': '已出局', 'hud.down': '等隊友舔醒', 'hud.freed': '已解放 {freed}／{total} 隻貓',
  'skill.ready': '必殺OK！撳 {key}', 'skill.beam': '三眼光炮！', 'skill.gulp': '啊——',
  'down.help': '隊友！救我！', 'revived': '舔醒咗！', 'life.lost': '-1 命',
  'poster.lost1': '尋貓', 'poster.lost2': '有賞', 'poster.rat1': '赤鼠', 'poster.rat2': '帝國',
  // weapons
  'w.N': '爪擊彈', 'w.S': '毛球散射', 'w.M': '貓砂機槍', 'w.L': '激光筆', 'w.F': '木天蓼火球', 'w.R': '加速', 'w.B': '貓薄荷',
  // input
  'act.left': '向左', 'act.right': '向右', 'act.up': '向上瞄準', 'act.down': '伏低／落平台', 'act.jump': '跳（再撳一次＝二段跳）',
  'act.dash': '閃避衝刺', 'act.skill': '專屬技', 'act.lock': '鎖定站位（只轉方向）', 'act.pause': '暫停',
  'prof.pc': '鍵盤＋滑鼠', 'prof.classic1': '經典鍵盤 P1', 'prof.classic2': '經典鍵盤 P2',
  'ctl.pad': '手掣', 'ctl.touch': '觸控',
  'key.lshift': '左 Shift', 'key.rshift': '右 Shift', 'key.lctrl': '左 Ctrl', 'key.rctrl': '右 Ctrl', 'key.lalt': '左 Alt', 'key.ralt': '右 Alt',
  'key.num': '數字鍵 {n}', 'key.numShort': 'Num{n}',
  'skillkey.mouse': '{key}／右鍵', 'skillkey.pad': 'LB／Y', 'skillkey.touch': '「技」掣', 'skillkey.touchShort': '技',
  'clash.same': '同「{a}」用咗同一個鍵', 'clash.other': '同「{p}・{a}」撞鍵（{key}）',
  'touch.move': '移動', 'touch.aim': '瞄準射擊', 'touch.moveZone': '移動區', 'touch.aimZone': '瞄準射擊區',
  'touch.skill': '技', 'touch.dash': '衝', 'touch.jump': '跳',
  'foot.line': '© 2026 Aruo Co. Ltd. 版權所有', 'foot.link': '版權資料',
  'legal.title': '版權資料', 'legal.by': 'aruo entertainment by Aruo Co. Ltd',
  'legal.copy': '《喵斗羅 Meow-Tra》© 2026 Aruo Co. Ltd. 版權所有。',
  'legal.marks': '遊戲名稱、角色（火斑、大口、赤鼠帝國等）、美術、音樂同程式碼均屬 Aruo Co. Ltd. 所有。未經書面許可，不得複製、修改、發佈或作商業用途。',
  'legal.homage': '本遊戲向經典橫向捲軸射擊遊戲致敬，與 Konami 或《魂斗羅》版權持有人並無關連，亦未獲其認可。',
  'legal.fonts': '字體：Bungee、Bangers、Noto Sans HK（SIL Open Font License），經 Google Fonts 提供。',
  // story
  'story.skip': '跳過 ›', 'story.next': '下一格 ›', 'story.start': '出發！', 'story.aria': '開場故事',
  'story.1.cap': '喵喵市。每隻貓都有自己嘅天台、一笪太陽，同一個好長嘅午覺。',
  'story.2.cap': '直到某一晚，城市地底……', 'story.2.say': '今晚開始，全城隻貓——都要聽我鼠王指揮！',
  'story.3.cap': '腦波一掃過，全城嘅貓眼都變咗紅色漩渦。佢哋唔再係貓，而係赤鼠帝國嘅打手。',
  'story.4.cap': '除咗兩隻怪貓。', 'story.4.say1': '三隻眼……原來有用㗎！', 'story.4.say2': '呃……我個肚食咗啲咩？',
  'story.5.cap': '後巷秘密基地。毛球彈，上膛。', 'story.5.say1': '鼠王？我要佢叫我做大佬！', 'story.5.say2': '一、一定要去咩……？',
  'story.6.cap': '喵斗羅行動：打醒每一隻貓，打到鼠王巢穴為止！',
};

const en = {
  'doc.title': 'Meow-Tra · Contra-Cat',
  'canvas.aria': 'Meow-Tra game screen',
  'hud.sound': 'Sound', 'hud.muted': 'Muted', 'hud.pause': 'Pause',
  'title.tag': 'The Red Mouse Empire brainwashed every cat in town. Two oddball cat commandos go in to wake them up!',
  'title.solo': 'Solo Mission', 'title.coop': 'Co-op',
  'title.story': 'Story',
  'pick.aria': 'Choose your cat', 'pick.title': 'Choose your cat', 'pick.sub': 'In co-op, P2 plays the other one',
  'blaze.name': 'Blaze', 'gulp.name': 'Gulp',
  'blaze.skill': 'Third-Eye Beam', 'gulp.skill': 'Belly Gulp',
  'blaze.skillDesc': 'Skill: Third-Eye Beam blasts across the whole screen, then your shots home in',
  'gulp.skillDesc': 'Skill: Belly Gulp swallows bullets, then spits a piercing barrage',
  'bar.mode': 'Controls', 'bar.diff': 'Difficulty', 'bar.lang': 'Language',
  'bar.stage': 'Stage', 'clear.next': 'Next Stage',
  'clear.title4': 'Stage 4 Clear!', 'clear.text4': 'The brainwave spider mech is scrap — Dr. Rat flew off in its cockpit. Next stop: the Freezer Tundra (coming soon).',
  'say.stage4': 'STAGE 4  Pet Hospital Basement', 'say.drill': 'Mid-boss: Red Mouse Drill Digger', 'say.drillDown': 'The Drill Digger fell down the shaft!', 'say.spider': 'Dr. Rat’s Brainwave Spider Mech',
  'boss.drill': 'Red Mouse Drill Digger', 'boss.spider': 'Spider Mech · Dr. Rat', 'hypno.hit': 'Dizzy! Left and right swapped!',
  'spider.phase2': 'It’s on the ceiling!', 'spider.phase3': 'Legs gone — the cockpit flies!', 'lift.go': 'Going down…', 'tesla.zap': 'ZAP!',
  'clear.title3': 'Stage 3 Clear!', 'clear.text3': 'The robot koi has sunk and the Rat Admiral swam off. Next stop: the Pet Hospital basement.',
  'say.stage3': 'STAGE 3  Fish-Tank Falls', 'say.pirate': 'Mid-boss: Pirate Captain Cat', 'say.koi': 'Rat Admiral’s Robot Koi', 'say.pirateFreed': 'The Pirate Captain is free!',
  'boss.pirate': 'Pirate Captain Cat (brainwashed)', 'boss.koi': 'Robot Koi · Rat Admiral', 'pirate.yarr': 'YARRR!',
  'koi.phase2': 'Armour’s off — it’s furious!', 'koi.phase3': 'Admiral: FULL SPEED AHEAD!', 'koi.slam': 'Belly flop!',
  'air.low': 'Air low!', 'air.out': 'No air!', 'dive.tip': 'Diving: jump = swim stroke. Watch your air!',
  'clear.title1': 'Stage 1 Clear!', 'clear.text1': 'The Scratching-Post Fortress has fallen. Next stop: the Pet Hospital halls.',
  'clear.title2': 'Stage 2 Clear!', 'clear.text2': 'Dr. Rat’s surgery machine is scrap. Next stop: the Fish-Tank Falls.',
  'say.stage2': 'STAGE 2  Pet Hospital Halls',
  'say.headnurse': 'Mid-boss: Red Mouse Head Nurse', 'say.surgeon': 'Red Mouse Surgery Machine', 'say.nurseDown': 'Head Nurse is off duty!',
  'boss.headnurse': 'Red Mouse Head Nurse', 'boss.surgeon': 'Surgery Machine · Dr. Rat’s Jar', 'boss.jar': 'DR. RAT',
  'nurse.heal': '+HEAL', 'nurse.charge': 'Injection time!', 'cone.yowl': 'MROWWW!', 'surgeon.cut': 'Scalpel!',
  'mode.pc': 'Mouse + Keys', 'mode.classic': 'Classic Keys', 'mode.touch': 'Touch',
  'diff.nine': 'Nine Lives', 'diff.classic': 'Classic',
  'title.settings': 'Settings & Controls',
  'title.best': 'Best {score} · rank {rank}',
  'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.keys': 'Key Bindings', 'pause.quit': 'Back to Title',
  'over.title': 'All Cats Down', 'stat.score': 'Score', 'over.continue': 'Continue', 'over.continueN': 'Continue ({n} left)',
  'clear.title': 'Stage 1 Clear!', 'clear.text': 'The Scratching-Post Fortress has fallen. Next stop: the Pet Hospital halls (coming soon).',
  'stat.freed': 'Cats freed', 'stat.time': 'Time', 'stat.deaths': 'Knockdowns',
  'clear.rankInfo': 'Rank: one grade up for each of: clear in under 4 minutes, no knockdowns, free 70%+ of the cats, score 30,000+ (C → S).',
  'clear.again': 'Play Again',
  'clear.newBest': 'New record! Previous best {score}', 'clear.first': 'First clear — score saved', 'clear.best': 'Best {score} (rank {rank})',
  'set.title': 'Settings', 'set.mode': 'Controls', 'set.music': 'Music', 'set.sfx': 'Sound FX',
  'set.legend.pc': '<b>P1</b> <kbd>A</kbd><kbd>D</kbd> move　<kbd>S</kbd> crouch　<kbd>Space</kbd> jump (again in the air = double jump)<br>Aim with the mouse, <b>hold left button</b> to fire　<kbd>L Shift</kbd> dash　<b>Right button</b> / <kbd>E</kbd> skill<br><b>P2</b> uses a gamepad (push the right stick to fire), or the keyboard: <kbd>←↑→↓</kbd> move, Num <kbd>1</kbd> jump, auto-fires at enemies',
  'set.legend.classic': '<b>Auto-aim is on</b>: the gun locks onto the nearest enemy and fires by itself — you just run and jump. Hold <kbd>W</kbd> to shoot up.<br><b>P1</b> <kbd>A</kbd><kbd>D</kbd> move　<kbd>S</kbd> crouch　<kbd>J</kbd> jump　<kbd>K</kbd> dash　<kbd>I</kbd> skill (auto-aim off: <kbd>W</kbd> aim up, <kbd>L</kbd> hold position)<br><b>P2</b> <kbd>←↑→↓</kbd> move　Num <kbd>1</kbd> jump　<kbd>2</kbd> dash　<kbd>3</kbd> hold　<kbd>5</kbd> skill',
  'set.legend.touch': 'Left stick moves (down = crouch); push the right stick where you want to shoot.<br><b>JUMP</b> (again in the air = double jump), <b>DASH</b> dodge, <b>SKILL</b> special. Plug in a gamepad for P2.',
  'set.shake': 'Screen shake', 'on': 'On', 'off': 'Off',
  'set.autoaim': 'Auto-aim', 'set.autoaimOn': 'On: just run & jump', 'set.autoaimOff': 'Off: aim yourself',
  'set.assist': 'Aim assist', 'assist.normal': 'Normal', 'assist.strong': 'Strong',
  'set.keys': 'Key bindings', 'tab.classic1': 'Classic P1', 'tab.classic2': 'Classic P2',
  'set.keysHelp': 'Click a binding, then press the new key. Gamepad and touch use fixed layouts.',
  'set.reset': 'Reset Keys', 'set.done': 'Done',
  'set.also': 'also: ', 'set.aim': 'Aim', 'set.mouse': 'Mouse', 'set.fire': 'Fire', 'set.holdLeft': 'Hold left button',
  'set.skillAlt': 'Skill (alt)', 'set.rightBtn': 'Right button',
  'scope.pc': 'P1 in Mouse + Keys mode', 'scope.classic1': 'P1 in Classic Keys mode',
  'scope.classic2': 'P2 in Classic Keys mode — and P2 in Mouse + Keys co-op when there is no second gamepad',
  'scope.line': 'These keys are for {scope}. ', 'scope.unused': 'You picked “{mode}”, so this set is not in use right now.',
  'set.pressKey': 'Press a key… (Esc to cancel)', 'toast.reset': 'Key bindings reset',
  'toast.autoaim': 'Auto-aim is on: just run and jump (turn it off in Settings)',
  'toast.konami': 'Secret code! 30 lives next game!',
  'toast.meowOn': 'Secret code: Meow Gun! Every shot goes “meow” next game', 'toast.meowOff': 'Meow Gun off',
  'toast.jukebox': 'Secret code: jukebox unlocked! Press ♪ on the title screen',
  'title.jukebox': '♪ Jukebox',
  'combo.big': '{n} CHAIN!', 'hud.combo': '{n} COMBO', 'stomp': 'STOMP!',
  'say.bossDown': 'DESTROYED!', 'clear.perfect': 'No damage +10000',
  'secret.lost': 'LOST+FOUND', 'secret.got': 'Golden can! +1 life',
  'secret.count': 'Secret golden can {n}/4', 'secret.all': 'All found! Jukebox unlocked on the title screen',
  'secret.stomp': 'Secret move: head stomp!',
  'load.aria': 'Loading progress', 'load.text': 'Loading… {pct}% ({done}/{total})', 'load.fail': 'Couldn’t load {name}', 'load.reload': '. Please reload.',
  'tip.1': 'Tip: hit enemies to charge energy — when the bar flashes, fire your skill!',
  'tip.2': 'Tip: shoot the flying cans and grab the letter to switch guns.',
  'tip.3': 'Tip: in co-op, stand next to a downed buddy for a second to lick them awake.',
  'tip.4': 'Tip: you can’t be hit while dashing — dash through bullets.',
  'rotate': 'Turn your phone sideways for a much bigger screen',
  // in game
  'freed.1': 'Meow~', 'freed.2': 'Thanks!', 'freed.3': 'I’m awake!', 'freed.4': 'Free at last!',
  'say.stage1': 'STAGE 1  Back-Alley Catnip Jungle', 'say.go': 'GO!', 'say.join': 'P{n} joined!',
  'say.midboss': 'Mid-boss: Fat White Three-Eye', 'say.fortress': 'Red Mouse Scratching-Post Fortress', 'say.eliteFreed': 'Fat White Three-Eye is free!',
  'boss.fortress': 'Scratching-Post Fortress · Rat-Eye Core', 'boss.elite': 'Fat White Three-Eye (brainwashed)', 'boss.core': 'RAT-EYE CORE',
  'squeak': 'Squeak!', 'elite.roar': 'MRAOWW!',
  'hud.p2join': 'P2: press gamepad A or {key}', 'hud.skill': 'P{n} press {key}: SKILL!',
  'hud.dead': 'Respawning…', 'hud.out': 'Out', 'hud.down': 'Waiting for a lick', 'hud.freed': 'Cats freed {freed} / {total}',
  'skill.ready': 'SKILL READY! Press {key}', 'skill.beam': 'THIRD-EYE BEAM!', 'skill.gulp': 'GULP—',
  'down.help': 'Help me, buddy!', 'revived': 'Licked awake!', 'life.lost': '-1 LIFE',
  'poster.lost1': 'LOST', 'poster.lost2': 'CAT', 'poster.rat1': 'RED', 'poster.rat2': 'MOUSE',
  // weapons
  'w.N': 'Claw Shot', 'w.S': 'Hairball Spread', 'w.M': 'Litter Machine Gun', 'w.L': 'Laser Pointer', 'w.F': 'Catnip Fireball', 'w.R': 'Rapid Fire', 'w.B': 'Catmint Aura',
  // input
  'act.left': 'Left', 'act.right': 'Right', 'act.up': 'Aim up', 'act.down': 'Crouch / drop down', 'act.jump': 'Jump (again = double jump)',
  'act.dash': 'Dash', 'act.skill': 'Skill', 'act.lock': 'Hold position (turn only)', 'act.pause': 'Pause',
  'prof.pc': 'Mouse + Keys', 'prof.classic1': 'Classic Keys P1', 'prof.classic2': 'Classic Keys P2',
  'ctl.pad': 'Gamepad', 'ctl.touch': 'Touch',
  'key.lshift': 'L Shift', 'key.rshift': 'R Shift', 'key.lctrl': 'L Ctrl', 'key.rctrl': 'R Ctrl', 'key.lalt': 'L Alt', 'key.ralt': 'R Alt',
  'key.num': 'Num {n}', 'key.numShort': 'Num{n}',
  'skillkey.mouse': '{key} / right button', 'skillkey.pad': 'LB / Y', 'skillkey.touch': 'SKILL', 'skillkey.touchShort': 'SKILL',
  'clash.same': 'Same key as “{a}”', 'clash.other': 'Clashes with “{p} · {a}” ({key})',
  'touch.move': 'Move', 'touch.aim': 'Aim & fire', 'touch.moveZone': 'Move area', 'touch.aimZone': 'Aim and fire area',
  'touch.skill': 'SKILL', 'touch.dash': 'DASH', 'touch.jump': 'JUMP',
  'foot.line': '© 2026 Aruo Co. Ltd. All rights reserved.', 'foot.link': 'Copyright',
  'legal.title': 'Copyright', 'legal.by': 'aruo entertainment by Aruo Co. Ltd',
  'legal.copy': 'Meow-Tra (喵斗羅) © 2026 Aruo Co. Ltd. All rights reserved.',
  'legal.marks': 'The game title, characters (Blaze, Gulp, the Red Mouse Empire and others), artwork, music and code belong to Aruo Co. Ltd. No copying, modifying, redistributing or commercial use without written permission.',
  'legal.homage': 'An homage to classic run-and-gun games. Not affiliated with or endorsed by Konami or the owners of Contra.',
  'legal.fonts': 'Fonts: Bungee, Bangers and Noto Sans HK (SIL Open Font License), served by Google Fonts.',
  // story
  'story.skip': 'Skip ›', 'story.next': 'Next ›', 'story.start': 'Let’s go!', 'story.aria': 'Opening story',
  'story.1.cap': 'Meow City. Every cat had a rooftop, a patch of sun and a very long nap.',
  'story.2.cap': 'Until one night, deep under the city…', 'story.2.say': 'From tonight, every cat in this city works for ME — the Rat King!',
  'story.3.cap': 'One sweep of the brainwave and every cat’s eyes turned to red spirals. They weren’t cats any more. They were the Red Mouse Empire’s muscle.',
  'story.4.cap': 'Except two weirdos.', 'story.4.say1': 'Three eyes… so they ARE good for something!', 'story.4.say2': 'Uh… what did my belly just eat?',
  'story.5.cap': 'A secret back-alley hideout. Hairball rounds: loaded.', 'story.5.say1': 'The Rat King? He’s gonna call ME boss!', 'story.5.say2': 'D-do we really have to go…?',
  'story.6.cap': 'Operation MEOW-TRA: wake up every cat, all the way to the Rat King’s lair!',
};

const DICT = { zh, en };

export function t(key, vars) {
  let s = DICT[lang][key] ?? zh[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

export function setLang(l) {
  try { localStorage.setItem(STORE_KEY, l); } catch { /* not persisted */ }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.toString());
}

// fill static markup: data-i18n (text), data-i18n-html (trusted markup from the dictionary), data-i18n-aria
export function applyStatic(root = document) {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-HK';
  document.title = t('doc.title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
