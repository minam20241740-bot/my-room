var NAME_KEY = "Portfolio.CampusMarket.Name";
var DEFAULT_NAME = "방문자";
function loadName() {
  try {
    var n = localStorage.getItem(NAME_KEY);
    if (n && n.trim()) return n.trim().slice(0, 12);
  } catch (error) {}
  return DEFAULT_NAME;
}
var ME = loadName();

var CATEGORY_NAMES = { elec: "가전제품", furniture: "가구/소품", book: "전공서적", etc: "기타" };

var itemsData = [
  { id: 1, title: "LED 스탠드 (흰색)", category: "elec", giver: "박성우", place: "정문 카페 앞", postedAt: "2026-09-15T01:00:00+09:00", status: "open", image: "assets/stand.jpg", alt: "책상 위에 불이 켜진 흰색 LED 스탠드", desc: "밝기 3단계 조절되는 책상용 스탠드입니다. 1년 정도 사용했고 작동에는 전혀 문제가 없습니다. 자취방 정리하면서 내놓아요." },
  { id: 2, title: "3단 책꽂이", category: "furniture", giver: "만두언니", place: "후문 편의점 앞", postedAt: "2026-09-14T23:30:00+09:00", status: "open", image: "assets/shelf.jpg", alt: "나무 무늬 3단 책꽂이", desc: "원목 무늬 3단 책꽂이입니다. 모서리에 생활 기스가 조금 있습니다." },
  { id: 3, title: "클립형 스탠드", category: "elec", giver: "최민재", place: "녹양역 3번 출구", postedAt: "2026-09-14T20:00:00+09:00", status: "open", image: null, alt: "", desc: "침대 프레임에 끼워 쓰는 클립형 독서등입니다. USB 전원입니다." },
  { id: 90, kind: "want", title: "전자레인지 구합니다", category: "elec", giver: "이서연", place: "기숙사 2동 로비", postedAt: "2026-09-14T22:00:00+09:00", status: "open", image: null, alt: "", desc: "자취방에서 쓸 소형 전자레인지를 무료로 받고 싶습니다. 작동만 되면 괜찮습니다." },
  { id: 4, title: "접이식 테이블", category: "furniture", giver: "정유진", place: "기숙사 1동 로비", postedAt: "2026-09-13T10:00:00+09:00", status: "hold", image: "assets/table.jpg", alt: "방 안에 펼쳐 둔 어두운 상판의 접이식 테이블", desc: "캠핑 겸용 접이식 테이블입니다. 상판 60x40 크기입니다." }
];

var myApplications = [
  { itemId: null, item: "전자레인지 (소형)", giver: "김도윤", place: "학생회관 앞", time: "2026-09-12 12:00", status: "done" },
  { itemId: null, item: "화이트보드 (중형)", giver: "박성우", place: "디자인관 1층", time: "2026-09-22 17:00", status: "wait" },
  { itemId: null, item: "미니 서랍장", giver: "이서연", place: "기숙사 2동 로비", time: "2026-09-25 12:00", status: "ready" },
  { itemId: null, item: "USB 선풍기", giver: "만두언니", place: "정문 카페 앞", time: "2026-08-28 17:00", status: "expired" }
];

var DEMO_ITEM_IDS = [1, 2, 3, 4, 90];
function isDemoItem(item) { return DEMO_ITEM_IDS.indexOf(item.id) !== -1; }
function isMine(item) {
  if (item.mine === true) return true;
  if (item.mine === undefined && DEMO_ITEM_IDS.indexOf(item.id) === -1 && item.giver === "\uae40\uc9c0\ud604") return true;
  return false;
}
function isWant(item) { return item.kind === "want"; }

var STATUS = {
  wait: { label: "수락 대기", cls: "badge-wait" },
  ready: { label: "수령 예정", cls: "badge-ready" },
  done: { label: "수령 완료", cls: "badge-done" },
  expired: { label: "기한 만료", cls: "badge-expired" },
  canceled: { label: "취소됨", cls: "badge-canceled" }
};
var TAB_ORDER = ["all", "wait", "ready", "done", "expired", "canceled"];

var state = { category: "all", kind: "all", query: "", openOnly: false, mineTab: "all", newItemId: null, newAppRef: null, applyItemId: null };

var storageKey = "Portfolio.CampusMarket.V1";
var registerPending = false;

function readCatalog() {
  try {
    var saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return "";
    if (saved.version !== 1 || !Array.isArray(saved.items) || !Array.isArray(saved.applications)) throw new Error("Invalid catalog");
    var ids = {};
    saved.items.forEach(function (item) {
      if (!item || !Number.isSafeInteger(item.id) || item.id < 1 || ids[item.id]
          || !Object.prototype.hasOwnProperty.call(CATEGORY_NAMES, item.category)
          || !(item.kind === undefined || item.kind === "give" || item.kind === "want")
          || !(item.mine === undefined || typeof item.mine === "boolean")
          || !["open", "hold"].includes(item.status)
          || !["title", "giver", "place", "desc", "postedAt"].every(function (key) { return typeof item[key] === "string"; })
          || !Number.isFinite(Date.parse(item.postedAt))
          || !(item.image === null || (typeof item.image === "string"
              && (item.image.startsWith("assets/") || item.image.startsWith("data:image/"))))) throw new Error("Invalid item");
      ids[item.id] = true;
    });
    saved.applications.forEach(function (app) {
      if (!app || !Object.prototype.hasOwnProperty.call(STATUS, app.status)
          || !(app.itemId === null || ids[app.itemId])
          || !["item", "giver", "place", "time"].every(function (key) { return typeof app[key] === "string"; })) throw new Error("Invalid application");
    });
    itemsData = saved.items;
    myApplications = saved.applications;
    return "";
  } catch (error) {
    return "저장한 목록을 읽지 못해 기본 목록을 열었습니다.";
  }
}

function writeCatalog(nextItems, nextApplications) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, items: nextItems, applications: nextApplications }));
    return true;
  } catch (error) {
    return false;
  }
}

function readPhoto(file) {
  if (!file) return Promise.resolve(null);
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(new Error("Photo read failed")); };
    reader.readAsDataURL(file);
  });
}

function $(id) { return document.getElementById(id); }

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function relativeTime(dateString) {
  var diffMins = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return diffMins + "분 전";
  var diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + "시간 전";
  return Math.floor(diffHours / 24) + "일 전";
}

var WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatPickup(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value || "");
  if (!m) return escapeHtml(value);
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number(m[2]) + "월 " + Number(m[3]) + "일(" + WEEKDAYS[d.getDay()] + ") " + m[4];
}

function photoHtml(item) {
  if (item.image) return '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.alt || item.title) + '">';
  return '<div class="no-photo">사진 없음</div>';
}

function findItem(id) {
  for (var i = 0; i < itemsData.length; i++) if (itemsData[i].id === id) return itemsData[i];
  return null;
}

function activeApplicationFor(item) {
  for (var i = 0; i < myApplications.length; i++) {
    var a = myApplications[i];
    if (a.itemId === item.id && (a.status === "wait" || a.status === "ready")) return a;
  }
  return null;
}

/* Short message at the bottom of the screen */
var toastTimer = null;
function showToast(message) {
  var t = $("toast");
  t.textContent = message;
  t.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 4000);
}

/* A new row or card stays highlighted until it has been on screen for 3 seconds */
var seenObserver = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    seenObserver.unobserve(entry.target);
    setTimeout(function () {
      entry.target.classList.remove("is-new");
      if (entry.target.classList.contains("mine-row")) state.newAppRef = null;
      if (entry.target.classList.contains("card")) state.newItemId = null;
    }, 3000);
  });
}, { threshold: 0.6 }) : null;
function watchNew(root) {
  if (!seenObserver) return;
  root.querySelectorAll(".is-new").forEach(function (el) { seenObserver.observe(el); });
}

/* Notice bar */
var notice = $("notice");
$("noticeToggle").addEventListener("click", function () {
  var open = notice.classList.toggle("is-open");
  this.setAttribute("aria-expanded", String(open));
  this.querySelector(".notice-toggle-text").textContent = open ? "접기" : "펼치기";
});
$("noticeClose").addEventListener("click", function () { notice.hidden = true; });

/* Item list */
function matchesQuery(item, q) {
  if (!q) return true;
  var hay = (item.title + " " + CATEGORY_NAMES[item.category] + " " + item.place + (isWant(item) ? " 구합니다" : " 나눔")).toLowerCase();
  return hay.indexOf(q) !== -1;
}

function renderItems() {
  var q = state.query.trim().toLowerCase();
  var list = itemsData.filter(function (item) {
    if (state.category !== "all" && item.category !== state.category) return false;
    if (state.kind !== "all" && (isWant(item) ? "want" : "give") !== state.kind) return false;
    if (state.openOnly && item.status !== "open") return false;
    return matchesQuery(item, q);
  });

  $("itemCount").textContent = list.length;
  $("itemsTitleText").textContent = state.kind === "want" ? "구합니다" : state.kind === "give" ? "나눔 물품" : "올라온 글";
  $("itemGrid").innerHTML = list.map(function (item) {
    var hold = item.status === "hold";
    var want = isWant(item);
    var badge = want ? '<span class="badge badge-want">구합니다</span>' : hold ? '<span class="badge badge-hold">예약됨</span>' : '<span class="badge badge-open">나눔 중</span>';
    var cls = "card" + (hold ? " is-hold" : "") + (item.id === state.newItemId ? " is-new" : "");
    return '<article class="' + cls + '">' +
      '<div class="card-photo">' + badge + (isDemoItem(item) ? '<span class="demo-tag">예시</span>' : '') + photoHtml(item) + '</div>' +
      '<div class="card-body">' +
        '<h3 class="card-title"><button type="button" class="card-link" data-id="' + item.id + '">' + escapeHtml(item.title) + '</button></h3>' +
        '<p class="card-meta">' + escapeHtml(item.place) + ' · ' + relativeTime(item.postedAt) + '</p>' +
        (isMine(item) ? '<p class="card-mine">' + (want ? '내가 올린 글' : '내가 올린 물품') + '</p>' : '') +
      '</div>' +
    '</article>';
  }).join("");
  watchNew($("itemGrid"));

  var empty = $("itemEmpty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    var text;
    if (q) text = "“" + state.query.trim() + "”에 맞는 글이 없습니다. 다른 이름이나 분류로 검색해 보세요.";
    else if (state.kind === "want") text = "아직 올라온 구합니다 글이 없습니다. 위의 ‘구합니다 등록’으로 첫 글을 올려 보세요.";
    else if (state.category !== "all") text = CATEGORY_NAMES[state.category] + " 분류에 올라온 글이 아직 없습니다.";
    else text = "지금 올라온 글이 없습니다.";
    $("itemEmptyText").textContent = text;
  }
}

$("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();
  document.getElementById("items").scrollIntoView({ block: "start" });
});
$("searchInput").addEventListener("input", function () { state.query = this.value; renderItems(); });

var kindChips = document.querySelectorAll(".chip[data-kind]");
kindChips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    kindChips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    chip.setAttribute("aria-pressed", "true");
    state.kind = chip.getAttribute("data-kind");
    renderItems();
  });
});

var chips = document.querySelectorAll(".chip[data-category]");
chips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    chip.setAttribute("aria-pressed", "true");
    state.category = chip.getAttribute("data-category");
    renderItems();
  });
});
$("openOnly").addEventListener("change", function () { state.openOnly = this.checked; renderItems(); });

function resetFilters() {
  state.category = "all"; state.kind = "all"; state.query = ""; state.openOnly = false;
  $("searchInput").value = ""; $("openOnly").checked = false;
  kindChips.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-kind") === "all" ? "true" : "false"); });
  chips.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-category") === "all" ? "true" : "false"); });
  renderItems();
}
$("resetFilters").addEventListener("click", resetFilters);

$("itemGrid").addEventListener("click", function (e) {
  var btn = e.target.closest(".card-link");
  if (btn) openDetail(Number(btn.getAttribute("data-id")), btn);
});

/* Modals: the newest one is on top, Tab stays inside it, Esc closes it, focus goes back to what opened it */
var modalStack = [];

function focusables(root) {
  return Array.prototype.filter.call(
    root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    function (el) { return !el.disabled && el.offsetParent !== null; }
  );
}

function topModal() { return modalStack.length ? modalStack[modalStack.length - 1].el : null; }

function openModal(modal, trigger, focusTarget) {
  modalStack.push({ el: modal, trigger: trigger || document.activeElement });
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  var target = focusTarget || focusables(modal.querySelector(".modal-panel"))[0];
  if (target) target.focus();
}

function closeTop() {
  var top = modalStack.pop();
  if (!top) return;
  top.el.hidden = true;
  if (!modalStack.length) document.body.style.overflow = "";
  if (top.trigger && document.body.contains(top.trigger) && top.trigger.offsetParent !== null) top.trigger.focus();
}

/* Designed confirm dialog used instead of the browser's confirm() */
var confirmModal = $("confirmModal");
var confirmAction = null;

function askConfirm(opts, onOk) {
  $("confirmTitle").textContent = opts.title;
  $("confirmMsg").textContent = opts.message;
  var summary = $("confirmSummary");
  if (opts.summary && opts.summary.length) {
    summary.innerHTML = opts.summary.map(function (row) {
      return "<dt>" + escapeHtml(row[0]) + "</dt><dd>" + escapeHtml(row[1]) + "</dd>";
    }).join("");
    summary.hidden = false;
  } else {
    summary.innerHTML = "";
    summary.hidden = true;
  }
  var ok = $("confirmOk");
  ok.textContent = opts.okText;
  ok.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
  $("confirmCancel").textContent = opts.cancelText;
  confirmAction = onOk;
  openModal(confirmModal, document.activeElement, opts.danger ? $("confirmCancel") : ok);
}

$("confirmOk").addEventListener("click", function () {
  var action = confirmAction;
  confirmAction = null;
  closeTop();
  if (action) action();
});
$("confirmCancel").addEventListener("click", function () { confirmAction = null; closeTop(); });

/* Closing a form that has input asks first */
function applyDirty() {
  if ($("applyView").hidden) return false;
  if ($("applyDate").value || $("applyTime").value || $("applyAgree").checked) return true;
  if ($("applyName").value !== ME) return true;
  return ["applySid", "applyPhone"].some(function (id) { return $(id).value !== $(id).defaultValue; });
}

function registerDirty() {
  if ($("registerForm").hidden) return false;
  var file = $("regFile").files && $("regFile").files.length;
  return !!($("regTitle").value.trim() || $("regDesc").value.trim() || $("regPlace").value.trim() || file || $("regCategory").value !== "elec");
}

function requestClose(modal) {
  if (modal !== topModal()) return;
  if (modal === confirmModal) { confirmAction = null; closeTop(); return; }
  var dirty = (modal === detailModal && applyDirty()) || (modal === registerModal && registerDirty());
  if (!dirty) { closeTop(); return; }
  askConfirm({
    title: modal === detailModal ? "작성 중인 신청서가 있습니다" : "작성 중인 등록 내용이 있습니다",
    message: "창을 닫으면 입력한 내용이 사라집니다.",
    okText: "닫기", cancelText: "계속 작성", danger: true
  }, function () {
    if (modal === detailModal) { state.applyItemId = null; }
    closeTop();
  });
}

document.querySelectorAll(".modal").forEach(function (modal) {
  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.closest("[data-close]")) requestClose(modal);
  });
});

document.addEventListener("keydown", function (e) {
  var top = topModal();
  if (!top) return;
  if (e.key === "Escape") { e.preventDefault(); requestClose(top); return; }
  if (e.key === "Tab") {
    var list = focusables(top.querySelector(".modal-panel"));
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
});

function showView(modal, viewId, labelId) {
  modal.querySelectorAll(".view").forEach(function (v) { v.hidden = v.id !== viewId; });
  modal.querySelector(".modal-panel").setAttribute("aria-labelledby", labelId);
}

/* Detail */
var detailModal = $("detailModal");
var registerModal = $("registerModal");
var currentItem = null;

function openDetail(id, trigger) {
  var item = findItem(id);
  if (!item) return;
  currentItem = item;
  $("detailMedia").innerHTML = photoHtml(item);
  var hold = item.status === "hold";
  var want = isWant(item);
  var mine = isMine(item);
  var badge = $("detailBadge");
  badge.className = "badge " + (want ? "badge-want" : hold ? "badge-hold" : "badge-open");
  badge.textContent = want ? "구합니다" : hold ? "예약됨" : "나눔 중";
  $("detailTitle").textContent = item.title;
  $("detailMeta").textContent = (want ? "작성자 " : "나눔자 ") + item.giver + " · " + item.place + " · " + relativeTime(item.postedAt) + (isDemoItem(item) ? " · 예시 데이터" : "");
  $("detailDesc").textContent = item.desc;

  var reason = "";
  var applied = activeApplicationFor(item);
  if (want) reason = mine ? "내가 올린 구합니다 글입니다." : "무료로 받을 물건을 찾는 글입니다. 나눔 제안 기능은 준비 중입니다.";
  else if (hold) reason = "다른 분이 먼저 예약한 물품이라 신청할 수 없습니다.";
  else if (mine) reason = "내가 올린 물품이라 신청할 수 없습니다.";
  else if (applied) reason = "이미 신청한 물품입니다. 진행 상태는 내 신청에서 볼 수 있습니다.";

  $("detailReason").hidden = !reason;
  $("detailReason").textContent = reason;
  $("showApplyBtn").hidden = want || !!reason;
  $("proposeBtn").hidden = !want || mine;
  $("goMineFromDetail").hidden = want || !applied || hold || mine;

  showView(detailModal, "detailView", "detailTitle");
  openModal(detailModal, trigger);
}

$("showApplyBtn").addEventListener("click", function () {
  if (!currentItem) return;
  $("applyThumb").innerHTML = photoHtml(currentItem);
  $("applyItem").textContent = currentItem.title;
  if (state.applyItemId !== currentItem.id) resetApplyForm();
  state.applyItemId = currentItem.id;
  showView(detailModal, "applyView", "applyTitle");
  $("applyDate").focus();
});

$("backToDetail").addEventListener("click", function () {
  showView(detailModal, "detailView", "detailTitle");
  $("showApplyBtn").focus();
});

$("goMineFromDetail").addEventListener("click", function () { closeTop(); goToMine(); });

/* Apply form */
function todayString() {
  var t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
}

var APPLY_FIELDS = ["applyDate", "applyTime", "applyName", "applySid", "applyPhone"];

function resetApplyForm() {
  $("applyForm").reset();
  $("applyName").value = ME;
  $("applyDate").setAttribute("min", todayString());
  $("applyError").textContent = "";
  APPLY_FIELDS.forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
}

function fail(errorBox, fieldId, message) {
  errorBox.textContent = message;
  var field = $(fieldId);
  if (field.type !== "checkbox") field.setAttribute("aria-invalid", "true");
  field.focus();
  return false;
}

function validateApply() {
  var err = $("applyError");
  err.textContent = "";
  APPLY_FIELDS.forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
  var date = $("applyDate").value, time = $("applyTime").value;
  if (!date) return fail(err, "applyDate", "희망 수령 날짜를 선택해 주세요.");
  if (!time) return fail(err, "applyTime", "희망 수령 시간을 선택해 주세요.");
  if (new Date(date + "T" + time) <= new Date()) return fail(err, "applyTime", "희망 수령 시간은 지금 이후로 선택해 주세요.");
  if (!$("applyName").value.trim()) return fail(err, "applyName", "이름을 입력해 주세요.");
  if (!/^[\d-]{4,14}$/.test($("applySid").value.trim())) return fail(err, "applySid", "학번은 숫자 4자리 이상으로 입력해 주세요. 예시 값이어도 됩니다.");
  if (!/^01\d-?\d{3,4}-?\d{4}$/.test($("applyPhone").value.trim())) return fail(err, "applyPhone", "연락처를 010-1234-5678 형식으로 입력해 주세요.");
  if (!$("applyAgree").checked) return fail(err, "applyAgree", "노쇼 페널티 안내에 동의해 주세요.");
  return true;
}

$("applyForm").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!currentItem) return;
  if (isWant(currentItem) || currentItem.status === "hold" || isMine(currentItem) || activeApplicationFor(currentItem)) {
    $("applyError").textContent = "이 물품은 신청할 수 없습니다. 물품 정보로 돌아가 이유를 확인해 주세요.";
    return;
  }
  if (!validateApply()) return;

  var time = $("applyDate").value + " " + $("applyTime").value;
  askConfirm({
    title: "신청 내용 확인",
    message: "아래 내용으로 신청합니다. 나눔자가 수락하면 수령 시간이 확정됩니다.",
    summary: [
      ["물품", currentItem.title],
      ["수령 장소", currentItem.place],
      ["희망 시간", formatPickup(time)],
      ["신청자", $("applyName").value.trim() + " · " + $("applySid").value.trim() + " · " + $("applyPhone").value.trim()]
    ],
    okText: "신청하기", cancelText: "수정하기"
  }, function () { submitApply(time); });
});

function submitApply(time) {
  var record = { itemId: currentItem.id, item: currentItem.title, giver: currentItem.giver, place: currentItem.place, time: time, status: "wait" };
  var nextApplications = [record].concat(myApplications);
  if (!writeCatalog(itemsData, nextApplications)) {
    $("applyError").textContent = "이 기기에 신청을 저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 신청해 주세요.";
    return;
  }
  myApplications = nextApplications;
  state.newAppRef = record;
  state.applyItemId = null;
  state.mineTab = "all";
  renderMine();
  $("doneDesc").textContent = currentItem.title + " · " + formatPickup(time) + ". 이 기기에 저장했습니다. 진행 상태는 내 신청에서 볼 수 있습니다.";
  showView(detailModal, "doneView", "doneTitle");
  $("goMineBtn").focus();
}

$("goMineBtn").addEventListener("click", function () { closeTop(); goToMine(); });

function goToMine() {
  state.mineTab = "all";
  renderMine();
  document.getElementById("mine").scrollIntoView({ block: "start" });
  var row = document.querySelector(".mine-row.is-new") || document.querySelector(".mine-row");
  var title = row ? row.querySelector(".mine-item") : null;
  if (title) { title.setAttribute("tabindex", "-1"); title.focus({ preventScroll: true }); }
}

/* Name shown in the header and used for posts and applications */
function showName() {
  $("userName").textContent = ME + "님";
  $("avatar").textContent = ME.charAt(0);
  $("nameBtn").setAttribute("aria-label", "이름 바꾸기 (지금 이름: " + ME + ")");
}
function saveName(name) {
  ME = name;
  try { localStorage.setItem(NAME_KEY, name); } catch (error) {}
  showName();
}
var nameModal = $("nameModal");
$("nameBtn").addEventListener("click", function () {
  $("nameInput").value = ME;
  $("nameError").textContent = "";
  $("nameInput").removeAttribute("aria-invalid");
  openModal(nameModal, this, $("nameInput"));
  $("nameInput").select();
});
$("nameForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = $("nameInput").value.trim();
  if (!name) return fail($("nameError"), "nameInput", "이름을 입력해 주세요.");
  saveName(name);
  closeTop();
  showToast("이름을 “" + name + "”(으)로 바꿨습니다.");
});

/* Register: 나눔 (give) or 구합니다 (want) */
function regKind() {
  var r = document.querySelector('input[name="regKind"]:checked');
  return r && r.value === "want" ? "want" : "give";
}
function applyRegKind() {
  var want = regKind() === "want";
  $("registerTitle").textContent = want ? "구합니다 등록" : "나눔 등록";
  $("regTitleLabel").textContent = want ? "구하는 물건" : "물품 이름";
  $("regPlaceLabel").textContent = want ? "받고 싶은 장소" : "수령 장소";
  $("regTitle").setAttribute("placeholder", want ? "예: 소형 전자레인지" : "예: 무선 마우스");
  $("regDesc").setAttribute("placeholder", want ? "어떤 물건이 필요한지, 언제까지 필요한지 적어 주세요" : "사용 기간과 상태를 적어 주세요");
  $("regPlace").setAttribute("placeholder", want ? "예: 기숙사 로비" : "예: 학생회관 앞");
  $("regKindHint").textContent = want ? "무료로 받고 싶은 물건을 적습니다. 돈 거래는 하지 않습니다." : "내가 가진 물건을 무료로 나눕니다.";
}
document.querySelectorAll('input[name="regKind"]').forEach(function (r) { r.addEventListener("change", applyRegKind); });

function openRegister(kind, trigger) {
  $("registerForm").reset();
  var radio = document.querySelector('input[name="regKind"][value="' + kind + '"]');
  if (radio) radio.checked = true;
  $("regName").value = ME;
  applyRegKind();
  $("regError").textContent = "";
  ["regTitle", "regDesc", "regPlace", "regName"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
  showView(registerModal, "registerForm", "registerTitle");
  openModal(registerModal, trigger, $("regTitle"));
}
$("openRegisterBtn").addEventListener("click", function () { openRegister("give", this); });
$("openWantBtn").addEventListener("click", function () { openRegister("want", this); });

$("registerForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var err = $("regError");
  err.textContent = "";
  ["regTitle", "regDesc", "regPlace"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
  var title = $("regTitle").value.trim();
  var desc = $("regDesc").value.trim();
  var place = $("regPlace").value.trim();
  var name = $("regName").value.trim();
  var kind = regKind();
  var want = kind === "want";
  if (!title) return fail(err, "regTitle", want ? "구하는 물건을 입력해 주세요." : "물품 이름을 입력해 주세요.");
  if (!desc) return fail(err, "regDesc", "상세 설명을 입력해 주세요.");
  if (!place) return fail(err, "regPlace", want ? "받고 싶은 장소를 입력해 주세요." : "수령 장소를 입력해 주세요.");
  if (!name) return fail(err, "regName", "이름을 입력해 주세요.");

  var file = $("regFile").files && $("regFile").files[0];
  askConfirm({
    title: "등록 내용 확인",
    message: want ? "아래 내용으로 구합니다 글을 등록합니다." : "아래 내용으로 나눔 물품을 등록합니다.",
    summary: [
      ["종류", want ? "구합니다" : "나눔"],
      [want ? "구하는 물건" : "물품 이름", title],
      ["분류", CATEGORY_NAMES[$("regCategory").value]],
      [want ? "받고 싶은 장소" : "수령 장소", place],
      ["이름", name],
      ["사진", file ? file.name : "없음 (목록에 \"사진 없음\"으로 표시)"]
    ],
    okText: "등록하기", cancelText: "수정하기"
  }, function () { submitRegister(title, desc, place, file, kind, name); });
});

async function submitRegister(title, desc, place, file, kind, name) {
  if (registerPending) return;
  registerPending = true;
  var submit = $("registerForm").querySelector("button[type=submit]");
  var category = $("regCategory").value;
  submit.disabled = true;
  try {
    var photo = await readPhoto(file);
    var maxId = itemsData.reduce(function (m, it) { return Math.max(m, it.id); }, 0);
    var item = {
      id: maxId + 1, kind: kind, mine: true, title: title, category: category, giver: name, place: place,
      postedAt: new Date().toISOString(), status: "open",
      image: photo, alt: title, desc: desc
    };
    var nextItems = [item].concat(itemsData);
    if (!writeCatalog(nextItems, myApplications)) {
      $("regError").textContent = "이 기기에 등록 내용을 저장하지 못했습니다. 사진 용량이나 브라우저 저장 공간을 확인하고 다시 등록해 주세요.";
      return;
    }
    itemsData = nextItems;
    state.newItemId = item.id;
    if (name !== ME) saveName(name);
    renderItems();
    $("regDoneTitle").textContent = kind === "want" ? "구합니다 글을 등록했습니다" : "나눔 물품을 등록했습니다";
    $("regDoneView").querySelector(".done-desc").textContent = "목록 맨 앞에 추가하고 이 기기에 저장했습니다.";
    showView(registerModal, "regDoneView", "regDoneTitle");
    $("showNewItemBtn").focus();
  } catch (error) {
    $("regError").textContent = "사진을 읽지 못했습니다. 사진 파일을 다시 선택해 주세요.";
  } finally {
    registerPending = false;
    submit.disabled = false;
  }
}

$("showNewItemBtn").addEventListener("click", function () {
  closeTop();
  resetFilters();
  document.getElementById("items").scrollIntoView({ block: "start" });
  var btn = document.querySelector('.card-link[data-id="' + state.newItemId + '"]');
  if (btn) btn.focus({ preventScroll: true });
});

/* My applications */
function countFor(tab) {
  if (tab === "all") return myApplications.length;
  return myApplications.filter(function (a) { return a.status === tab; }).length;
}

function renderMineTabs() {
  $("mineTabs").innerHTML = TAB_ORDER.map(function (tab) {
    var label = tab === "all" ? "전체" : STATUS[tab].label;
    var selected = state.mineTab === tab;
    return '<button type="button" class="tab" role="tab" data-tab="' + tab + '" aria-selected="' + selected + '" tabindex="' + (selected ? "0" : "-1") + '">' +
      label + '<span class="tab-count">' + countFor(tab) + '</span></button>';
  }).join("");
}

function renderMine() {
  renderMineTabs();
  var rows = myApplications.filter(function (a) { return state.mineTab === "all" || a.status === state.mineTab; });
  if (!rows.length) {
    $("myList").innerHTML = '<tr class="mine-empty"><td colspan="5">해당하는 신청이 없습니다.</td></tr>';
    return;
  }
  $("myList").innerHTML = rows.map(function (a) {
    var s = STATUS[a.status];
    var idx = myApplications.indexOf(a);
    var cancel = (a.status === "wait" || a.status === "ready")
      ? '<button type="button" class="btn-cancel" data-index="' + idx + '">신청 취소</button>' : "";
    return '<tr class="mine-row' + (a === state.newAppRef ? " is-new" : "") + '">' +
      '<td class="c-item"><span class="mine-item">' + escapeHtml(a.item) + '</span>' + (a.itemId === null ? ' <span class="demo-tag demo-tag-inline">예시</span>' : '') + '</td>' +
      '<td class="c-where mine-sub">' + escapeHtml(a.giver) + ' · ' + escapeHtml(a.place) + '</td>' +
      '<td class="c-time mine-sub">' + formatPickup(a.time) + '</td>' +
      '<td class="c-status"><span class="badge ' + s.cls + '">' + s.label + '</span></td>' +
      '<td class="c-action mine-action">' + cancel + '</td>' +
    '</tr>';
  }).join("");
  watchNew($("myList"));
}

$("mineTabs").addEventListener("click", function (e) {
  var tab = e.target.closest(".tab");
  if (!tab) return;
  state.mineTab = tab.getAttribute("data-tab");
  renderMine();
  document.querySelector('.tab[data-tab="' + state.mineTab + '"]').focus();
});

$("mineTabs").addEventListener("keydown", function (e) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  var i = TAB_ORDER.indexOf(state.mineTab) + (e.key === "ArrowRight" ? 1 : -1);
  state.mineTab = TAB_ORDER[(i + TAB_ORDER.length) % TAB_ORDER.length];
  renderMine();
  document.querySelector('.tab[data-tab="' + state.mineTab + '"]').focus();
});

$("myList").addEventListener("click", function (e) {
  var btn = e.target.closest(".btn-cancel");
  if (!btn) return;
  var app = myApplications[Number(btn.getAttribute("data-index"))];
  if (!app) return;
  askConfirm({
    title: "신청 취소",
    message: "“" + app.item + "” 신청을 취소합니다. 취소한 신청은 되돌릴 수 없습니다.",
    summary: [["나눔자 · 장소", app.giver + " · " + app.place], ["수령 시간", formatPickup(app.time)]],
    okText: "신청 취소", cancelText: "돌아가기", danger: true
  }, function () {
    var nextApplications = myApplications.map(function (entry) {
      return entry === app ? Object.assign({}, entry, { status: "canceled" }) : entry;
    });
    if (!writeCatalog(itemsData, nextApplications)) {
      showToast("취소 상태를 저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 취소해 주세요.");
      return;
    }
    app.status = "canceled";
    if (state.newAppRef === app) state.newAppRef = null;
    renderMine();
    showToast("“" + app.item + "” 신청을 취소했습니다.");
    var current = document.querySelector('.tab[aria-selected="true"]');
    if (current) current.focus();
  });
});

/* Current section in the header menu */
var navLinks = document.querySelectorAll(".nav-link");
function setCurrent(id) {
  navLinks.forEach(function (link) {
    var on = link.getAttribute("href") === "#" + id;
    link.classList.toggle("is-current", on);
    if (on) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
  });
}
navLinks.forEach(function (link) {
  link.addEventListener("click", function () { setCurrent(link.getAttribute("href").slice(1)); });
});
if ("IntersectionObserver" in window) {
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) { if (entry.isIntersecting) setCurrent(entry.target.id); });
  }, { rootMargin: "-120px 0px -60% 0px" });
  ["home", "items", "mine", "guide"].forEach(function (id) { spy.observe(document.getElementById(id)); });
}
setCurrent("home");

var storageMessage = readCatalog();
showName();
applyRegKind();
renderItems();
renderMine();
if (storageMessage) showToast(storageMessage);
