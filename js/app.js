(() => {
  // ===== Helpers
  const qs = new URLSearchParams(location.search);
  const city = (qs.get("city") || "rome").toLowerCase();

  // SCENES có thể là "SCENES" (global lexical) hoặc window.SCENES
  const SCENES_MAP = (typeof SCENES !== "undefined") ? SCENES : (window.SCENES || null);
  const EXPECTED = (typeof EXPECTED_CODE !== "undefined") ? EXPECTED_CODE : (window.EXPECTED_CODE || "2022");
  const STORAGE_CODE_KEY = (typeof STORAGE_CODE !== "undefined") ? STORAGE_CODE : (window.STORAGE_CODE || "SMB2022_CODE");
  const STORAGE_USED_KEY = (typeof STORAGE_USED !== "undefined") ? STORAGE_USED : (window.STORAGE_USED || "SMB2022_USED");

  if (!SCENES_MAP) {
    alert("Không thấy SCENES. Kiểm tra js/scenes.js đã load chưa.");
    return;
  }

  const sceneCfg = SCENES_MAP[city] || SCENES_MAP.rome;
  if (!sceneCfg) {
    alert("Không thấy cấu hình scene. Kiểm tra SCENES trong scenes.js");
    return;
  }

  // DOM
  const mv = document.getElementById("mv");
  const titleEl = document.getElementById("sceneTitle");
  const hudCodeEl = document.getElementById("hudCode");
  const toastEl = document.getElementById("toast");
  const barEl = document.getElementById("bar");
  const loadTextEl = document.getElementById("loadText");

  const btnHint = document.getElementById("btnHint");
  const btnSubmit = document.getElementById("btnSubmit");
  const btnClearScene = document.getElementById("btnClearScene");

  titleEl.textContent = sceneCfg.title || city.toUpperCase();

  // ===== LocalStorage
  function getCodeArr() {
    try { return JSON.parse(localStorage.getItem(STORAGE_CODE_KEY) || "[]"); }
    catch { return []; }
  }
  function setCodeArr(arr) {
    localStorage.setItem(STORAGE_CODE_KEY, JSON.stringify(arr));
    renderHUD();
  }
  function getUsedMap() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USED_KEY) || "{}"); }
    catch { return {}; }
  }
  function setUsedMap(map) {
    localStorage.setItem(STORAGE_USED_KEY, JSON.stringify(map));
  }

  function renderHUD() {
    const code = getCodeArr();
    hudCodeEl.textContent = (code.join("").padEnd(4, "_")).split("").join(" ");
  }

  function toast(msg, ms = 1400) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  renderHUD();

  // ===== Model src
  const rootUrl = "./scenes/";
  const fileName = sceneCfg.file;
  if (!fileName) {
    alert("Scene này chưa có file .glb trong scenes.js");
    return;
  }
  mv.src = rootUrl + fileName;

  // ===== Progress / Loaded
  barEl.style.width = "0%";
  loadTextEl.textContent = "Chạm/kéo để bắt đầu tải model…";

  // model-viewer bắn event progress (tùy phiên bản có detail.totalProgress 0..1)
  mv.addEventListener("progress", (e) => {
    const p = Math.round(((e.detail && (e.detail.totalProgress ?? e.detail.progress)) || 0) * 100);
    if (Number.isFinite(p)) {
      barEl.style.width = p + "%";
      loadTextEl.textContent = `Đang tải… ${p}%`;
    }
  });

  mv.addEventListener("load", () => {
    barEl.style.width = "100%";
    loadTextEl.textContent = "Tải xong. Kéo để xoay/zoom, bấm hotspot để tìm số!";
    buildHotspots();
  });

  // ===== Hotspot click logic
  function handleHotspotClick(h, key, btnEl) {
    const used = getUsedMap();
    if (used[key]) return toast("Hotspot này bạn lấy rồi.");

    if (h.decoy) return toast("Sai rồi 😅");

    used[key] = true;
    setUsedMap(used);
    if (btnEl) btnEl.style.opacity = "0.25";

    const code = getCodeArr();
    if (code.length >= 4) return toast("Bạn đã đủ 4 số. Bấm Submit!");

    code.push(String(h.rewardDigit ?? ""));
    setCodeArr(code);
    toast(`✅ Nhận số: ${h.rewardDigit}`);
  }

  // ===== Build hotspots for model-viewer
  function fmtPos(posArr) {
    // model-viewer: "x m y m z m" (an toàn nhất)
    const [x, y, z] = posArr;
    return `${x}m ${y}m ${z}m`;
  }
  function fmtNormal(nArr) {
    const [x, y, z] = nArr;
    return `${x}m ${y}m ${z}m`;
  }

  function clearHotspots() {
    [...mv.querySelectorAll(".mv-hotspot")].forEach(el => el.remove());
  }

  function buildHotspots() {
    clearHotspots();

    const hotspots = Array.isArray(sceneCfg.hotspots) ? sceneCfg.hotspots : [];
    const used = getUsedMap();

    if (!hotspots.length) {
      console.warn("Không có hotspots trong sceneCfg.hotspots");
      toast("Scene chưa có hotspot.");
      return;
    }

    hotspots.forEach((h, idx) => {
      // ✅ tương thích scenes.js của bạn: h.pos là bắt buộc
      const pos = h.pos;
      if (!Array.isArray(pos) || pos.length !== 3) {
        console.warn("Hotspot thiếu pos:", h);
        return;
      }

      const key = `${city}:${h.id || idx}`;
      const slotName = `hotspot-${h.id || idx}`;

      const btn = document.createElement("button");
      btn.className = "mv-hotspot";
      btn.setAttribute("slot", slotName);

      // data-position / data-normal là chuẩn của model-viewer hotspot
      btn.dataset.position = fmtPos(pos);

      // normal: nếu bạn không có normal thì cho default hướng lên
      const normal = Array.isArray(h.normal) && h.normal.length === 3 ? h.normal : [0, 1, 0];
      btn.dataset.normal = fmtNormal(normal);

      // UI: hiển thị chấm/label nhỏ để test
      btn.textContent = h.id || `hs${idx + 1}`;
      btn.style.padding = "0";
      btn.style.width = "30px";
      btn.style.height = "30px";
      btn.style.borderRadius = "999px";
      btn.style.border = "1px solid rgba(255,180,90,0.65)";
      btn.style.background = "rgba(255,122,0,0.22)";
      btn.style.color = "#ffb36b";
      btn.style.fontSize = "11px";
      btn.style.cursor = "pointer";
      btn.style.opacity = used[key] ? "0.25" : "1";

      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        handleHotspotClick(h, key, btn);
      });

      mv.appendChild(btn);
    });

    console.log("HOTSPOTS CREATED:", mv.querySelectorAll(".mv-hotspot").length);
  }

  // ===== Hint / Clear / Submit
  btnHint.onclick = () => alert(sceneCfg.hint || "Chưa có gợi ý.");

  btnClearScene.onclick = () => {
    const used = getUsedMap();
    Object.keys(used)
      .filter(k => k.startsWith(city + ":"))
      .forEach(k => delete used[k]);
    setUsedMap(used);
    toast("Đã xóa lựa chọn của cảnh này.");
    buildHotspots();
  };

  btnSubmit.onclick = () => {
    const code = getCodeArr().join("");
    if (code.length < 4) return alert("Chưa đủ 4 số. Hãy quay lại tìm tiếp!");
    if (code === EXPECTED) alert("🎉 CHÚC MỪNG! Mã đúng: " + code);
    else alert("❌ Sai rồi. Mã bạn thu là: " + code + "\nBấm Reset ở trang chính để chơi lại.");
  };

  // ===== Tool lấy tọa độ (model-viewer)
  // Bấm C để bật/tắt, rồi click vào model để log position/normal
  let capture = false;

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c") {
      capture = !capture;
      toast(capture ? "BẬT lấy tọa độ: click vào model" : "TẮT lấy tọa độ");
    }
  });

  mv.addEventListener("pointerdown", async (ev) => {
    if (!capture) return;

    // model-viewer: positionAndNormalFromPoint(x, y) với tọa độ theo viewer
    const rect = mv.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    if (typeof mv.positionAndNormalFromPoint !== "function") {
      toast("Model-viewer chưa hỗ trợ positionAndNormalFromPoint (phiên bản).");
      return;
    }

    const hit = await mv.positionAndNormalFromPoint(x, y);
    if (!hit || !hit.position) {
      toast("Không pick được điểm (click trúng nền/không trúng mesh).");
      return;
    }

    const p = hit.position; // {x,y,z}
    const n = hit.normal || { x: 0, y: 1, z: 0 };

    console.log("PICK POS:", [p.x, p.y, p.z]);
    console.log("PICK NORMAL:", [n.x, n.y, n.z]);
    toast("Đã log tọa độ vào Console (F12)");
  });

})();