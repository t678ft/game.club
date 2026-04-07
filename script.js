const basePcState = [
  { id: "PC-01", zone: "Prime", status: "free" },
  { id: "PC-02", zone: "Prime", status: "busy" },
  { id: "PC-03", zone: "Prime", status: "free" },
  { id: "PC-04", zone: "Prime", status: "busy" },
  { id: "PC-05", zone: "Bootcamp", status: "free" },
  { id: "PC-06", zone: "Bootcamp", status: "free" },
  { id: "PC-07", zone: "Bootcamp", status: "busy" },
  { id: "PC-08", zone: "Bootcamp", status: "free" },
  { id: "PC-09", zone: "Arena", status: "busy" },
  { id: "PC-10", zone: "Arena", status: "free" },
  { id: "PC-11", zone: "Arena", status: "free" },
  { id: "PC-12", zone: "Arena", status: "busy" },
];

const pcState = structuredClone(basePcState);
const pcGrid = document.getElementById("pc-grid");
const selectedSlot = document.getElementById("selected-slot");
const bookingForm = document.getElementById("booking-form");
const bookingResult = document.getElementById("booking-result");
const bookingDate = document.getElementById("booking-date");
const bookingTime = document.getElementById("booking-time");
const bookingHistory = document.getElementById("booking-history");
const bookingPlan = document.getElementById("booking-plan");
const bookingDuration = document.getElementById("booking-duration");
const pricePreview = document.getElementById("price-preview");
const STORAGE_KEY = "gameclub-bookings";
const supabaseUrl = window.GAMECLUB_SUPABASE_URL || "";
const supabaseAnonKey = window.GAMECLUB_SUPABASE_ANON_KEY || "";
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey && window.supabase);
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

let activePcId = null;
let refreshTimer = null;

const now = new Date();
const isoDate = now.toISOString().slice(0, 10);
bookingDate.value = isoDate;

const defaultTime = new Date(now.getTime() + 60 * 60 * 1000);
bookingTime.value = `${String(defaultTime.getHours()).padStart(2, "0")}:${String(defaultTime.getMinutes()).padStart(2, "0")}`;

function showMessage(message, isError = false) {
  bookingResult.classList.add("visible");
  bookingResult.innerHTML = message;
  bookingResult.style.borderColor = isError ? "rgba(255,95,112,0.4)" : "rgba(255,107,107,0.28)";
}

function maskPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) {
    return phone;
  }

  return `+${digits.slice(0, 2)} *** *** ${digits.slice(-2)}`;
}

function getPlanDetails() {
  const plan = bookingPlan.value;
  const duration = Number(bookingDuration.value);

  if (plan === "prime") {
    return { label: "Прайм", total: 650 };
  }

  if (plan === "night") {
    return { label: "Ночной режим", total: 990 };
  }

  return { label: "Старт", total: duration * 150 };
}

function renderPricePreview() {
  const details = getPlanDetails();
  pricePreview.textContent = `Итог: ${details.total} ₽ • ${details.label}`;
}

function getBookingEndTime(booking) {
  if (booking.expires_at) {
    return new Date(booking.expires_at).getTime();
  }

  const start = new Date(`${booking.date ?? booking.booking_date}T${booking.time ?? booking.booking_time}`);
  const durationHours = Number(booking.duration) || 0;

  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  return start.getTime() + durationHours * 60 * 60 * 1000;
}

function getLocalBookings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function pruneLocalExpiredBookings() {
  const activeBookings = getLocalBookings().filter((booking) => getBookingEndTime(booking) > Date.now());
  saveLocalBookings(activeBookings);
  return activeBookings;
}

async function pruneRemoteExpiredBookings() {
  if (!supabaseClient) {
    return;
  }

  await supabaseClient.from("bookings").delete().lte("expires_at", new Date().toISOString());
}

async function getActiveBookings() {
  if (!supabaseClient) {
    return pruneLocalExpiredBookings();
  }

  await pruneRemoteExpiredBookings();
  const { data, error } = await supabaseClient
    .from("bookings")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

function syncPcStateWithBookings(bookings) {
  const bookedIds = new Set(bookings.map((booking) => booking.pcId ?? booking.pc_id));

  pcState.forEach((pc) => {
    pc.status = bookedIds.has(pc.id) ? "busy" : "free";
  });
}

function renderBookingHistory(bookings) {
  if (!bookings.length) {
    bookingHistory.innerHTML = `
      <h4>Сохранённые брони</h4>
      <div class="booking-entry">Пока броней нет.</div>
    `;
    return;
  }

  bookingHistory.innerHTML = `
    <h4>Сохранённые брони</h4>
    <div class="booking-history-list">
      ${bookings
        .slice(-4)
        .reverse()
        .map((booking) => {
          const pcId = booking.pcId ?? booking.pc_id;
          const date = booking.date ?? booking.booking_date;
          const time = booking.time ?? booking.booking_time;
          const planLabel = booking.planLabel ?? booking.plan_label;
          return `
            <div class="booking-entry">
              <strong>${booking.name} • ${pcId}</strong>
              <div>${date}, ${time} • ${booking.duration} ч. • ${planLabel}</div>
              <div>${booking.total} ₽</div>
              <div>${maskPhone(booking.phone)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPcGrid() {
  pcGrid.innerHTML = "";

  pcState.forEach((pc) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pc-slot ${pc.status}${pc.id === activePcId ? " selected" : ""}`;
    button.disabled = pc.status === "busy";
    button.innerHTML = `
      <strong>${pc.id}</strong>
      <small>${pc.zone}</small>
      <small>${pc.status === "free" ? "Свободно" : "Занято"}</small>
    `;

    button.addEventListener("click", () => {
      if (pc.status !== "free") {
        return;
      }

      activePcId = pc.id;
      selectedSlot.textContent = `${pc.id} • ${pc.zone} • готово к бронированию`;
      renderPcGrid();
    });

    pcGrid.appendChild(button);
  });
}

async function refreshBookings(showErrors = false) {
  try {
    const bookings = await getActiveBookings();
    syncPcStateWithBookings(bookings);
    renderPcGrid();
    renderBookingHistory(bookings);
  } catch (error) {
    if (showErrors) {
      showMessage("Не удалось получить брони из базы. Проверьте настройки Supabase.", true);
    }
  }
}

function buildBookingPayload(formValues) {
  const startAt = new Date(`${formValues.date}T${formValues.time}`);
  const expiresAt = new Date(startAt.getTime() + Number(formValues.duration) * 60 * 60 * 1000);

  return {
    name: formValues.name,
    phone: formValues.phone,
    pc_id: formValues.pcId,
    zone: formValues.zone,
    plan: formValues.plan,
    plan_label: formValues.planLabel,
    booking_date: formValues.date,
    booking_time: formValues.time,
    duration: Number(formValues.duration),
    total: formValues.total,
    pin_length: formValues.pin.length,
    start_at: startAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
}

async function createBooking(formValues) {
  if (!supabaseClient) {
    const bookings = pruneLocalExpiredBookings();
    bookings.push({
      ...formValues,
      pinLength: formValues.pin.length,
      expires_at: new Date(new Date(`${formValues.date}T${formValues.time}`).getTime() + Number(formValues.duration) * 60 * 60 * 1000).toISOString(),
    });
    saveLocalBookings(bookings);
    return;
  }

  const payload = buildBookingPayload(formValues);
  const { error } = await supabaseClient.from("bookings").insert(payload);

  if (error) {
    throw error;
  }
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activePcId) {
    showMessage("Сначала выберите свободный ПК.", true);
    return;
  }

  const name = document.getElementById("booking-name").value.trim();
  const phone = document.getElementById("booking-phone").value.trim();
  const pin = document.getElementById("booking-pin").value.trim();
  const duration = bookingDuration.value;
  const planDetails = getPlanDetails();
  const pc = pcState.find((item) => item.id === activePcId);

  if (name.length < 2) {
    showMessage("Укажите имя.", true);
    return;
  }

  if (phone.length < 6) {
    showMessage("Укажите номер телефона.", true);
    return;
  }

  if (pin.length < 4) {
    showMessage("PIN-код должен содержать минимум 4 цифры.", true);
    return;
  }

  if (!pc || pc.status === "busy") {
    showMessage("Это место уже занято. Обновите список и выберите другое.", true);
    await refreshBookings();
    return;
  }

  const formValues = {
    name,
    phone,
    pin,
    pcId: pc.id,
    zone: pc.zone,
    plan: bookingPlan.value,
    planLabel: planDetails.label,
    date: bookingDate.value,
    time: bookingTime.value,
    duration,
    total: planDetails.total,
  };

  try {
    await createBooking(formValues);
    showMessage(`
      <strong>Бронь подтверждена.</strong><br />
      Имя: ${name}<br />
      Телефон: ${maskPhone(phone)}<br />
      Место: ${pc.id} (${pc.zone})<br />
      Тариф: ${planDetails.label}<br />
      Дата: ${bookingDate.value}<br />
      Время: ${bookingTime.value}<br />
      Длительность: ${duration} ч.<br />
      Итог: ${planDetails.total} ₽<br />
      PIN: ${"*".repeat(pin.length)}
    `);
    activePcId = null;
    selectedSlot.textContent = "Выберите свободный ПК на схеме справа.";
    bookingForm.reset();
    bookingDate.value = isoDate;
    bookingTime.value = `${String(defaultTime.getHours()).padStart(2, "0")}:${String(defaultTime.getMinutes()).padStart(2, "0")}`;
    bookingPlan.value = "hourly";
    bookingDuration.value = "1";
    renderPricePreview();
    await refreshBookings();
  } catch (error) {
    showMessage("Не удалось сохранить бронь. Если место уже занято, обновите страницу.", true);
  }
});

bookingPlan.addEventListener("change", renderPricePreview);
bookingDuration.addEventListener("change", renderPricePreview);

if (supabaseClient) {
  refreshTimer = setInterval(() => {
    refreshBookings();
  }, 15000);
} else {
  showMessage("Сайт работает в локальном режиме. Для общей синхронизации устройств заполните `supabase-config.js`.", true);
}

renderPricePreview();
refreshBookings(true);

window.addEventListener("beforeunload", () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});
